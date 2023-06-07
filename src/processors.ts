import { QueryEngine } from "@comunica/query-sparql";
import {Config, getConfig} from "./parseConfig";
import * as n3 from "n3";
import {RDF, SDS, TREE} from "@treecg/types";
import {DataFactory, Quad, Literal, NamedNode} from "n3";
import namedNode = DataFactory.namedNode;
import {TreeCollection} from "./tree";
import { Stream, Writer } from "@treecg/connector-types";
import PATH from "path";
import {
    addExtra, addPrefix,
    createDir, ensure,
    escape,
    exists,
    extract_resource_from_uri, getMemberQuads, getRelationQuads,
    n3_escape, replPredicate, SDSToTree, serialize_quads,

} from "./utils";
import * as fs from "fs/promises";


const queryEngine = new QueryEngine();

/**
 * The query_sparql processor fetches query result from a SPRAQL endpoint
 * @param configPath PATH to a config file. For example, ./config.json
 * @param writer a stream writer instance
 */
export async function querySparql(configPath: string, writer: Writer<string>) {
  const config: Config = getConfig(configPath);
  await config.setup();
  doQuery(config, writer)
}

async function doQuery(config: Config, writer: Writer<string>){
    await new Promise(res => setTimeout(res, 3000))
    const quadStream = await queryEngine.queryQuads(config.sparqlQuery, { sources: [config.sparqlEndpoint] });
    const quads = await quadStream.toArray()
    await writer.push(serialize_quads(quads.map(q => <Quad>q)));
    await writer.disconnect()
}

/**
 * The sds_to_tree processor transforms SDS bucktized data, streamed from a prior bucketization process into TREE data
 * @param configPath PATH to a config file. For example, ./config.json
 * @param reader Readable stream
 * @param meta_reader Readable stream
 * @param treeMemberOutputStream Writeable stream
 */
export async function sds_to_tree(configPath:string,
                            reader:Stream<Quad[]>,
                            meta_reader:Stream<Quad[]>,
                            treeMemberOutputStream:Writer<string>) {

    const config = getConfig(configPath)
    meta_reader
        .on('data', async quad =>{
            console.log(quad)
        })
        .on('end', ()=>{
            console.log("All meta_read have been read.")
            meta_reader.disconnect()
        })
    reader
        .on('data', async quads => {
            /** escape n3js issued symbols /[\x00-\x20<>\\"\{\}\|\^\`]/ */
            let t = ensure(quads.map(q => n3_escape(q)))
            /** convert vocabulary */
            t = ensure(t.map(q => replPredicate(q, SDSToTree)))
            /** add bucketBase and add extra type quads */
            t = t.map(q => addPrefix(config, q))
            /** add extra quads */
                // <node> rdf:type tree:Node.
            let tree_quads = t
            for (const q of t) {
                tree_quads = [...tree_quads, ...addExtra(config, q)]
            }
            await treeMemberOutputStream.push(serialize_quads(tree_quads))
        })
    reader.on('end',()=>{
        reader.disconnect()
        console.log('All sds_tree reader data have been read.')
    })
    await treeMemberOutputStream.disconnect()
}

/**+
 * The ingest processor materialize quads of TREE to files
 * @param configPath PATH to a config file. For example, ./config.json
 * @param treeMemberInputStream readable stream
 */
export async function ingest(configPath: string, treeMemberInputStream: Stream<string>) {
    const config = getConfig(configPath)
    const out_dir = createDir(PATH.resolve('out'))
    let counter:{[key:string]: any}= {}
    const tree_collection = new TreeCollection(namedNode(config.namespaceIRI), configPath, new n3.Store())
    const tree_collection_out = PATH.join(out_dir, 'tree_collection.ttl')
    treeMemberInputStream
        .on('data', async quadString => {
            /** write tree collection meta quads */
            if (!exists(tree_collection_out)) {
                await fs.appendFile(tree_collection_out,
                    new n3.Writer().quadsToString(tree_collection.serialize_metadata()))
            }
            const quads = [... new Set(new n3.Parser().parse(quadString))]
            /** member node(s)*/
            // each chunk of quads is expected to have at least one treeNode
            const buckets = [...new Set(quads.filter(q=>q.predicate.equals(SDS.terms.bucket)).map(q=><NamedNode>q.object))]
            /** member quads */
            const member_quads = getMemberQuads(config, quads)
            /** write member quads */
            for (const b of buckets) {
                const out = PATH.join(out_dir, escape(extract_resource_from_uri(b.value)) + '.ttl')
                await fs.appendFile(out, new n3.Writer().quadsToString(member_quads))
            }
            /** relation quads */
            const parent_buckets = [...new Set(quads.filter(q=>q.predicate.equals(TREE.terms.relation)).map(q=>q.subject.value))]
            const rel_quads = getRelationQuads(config, quads, buckets, counter)
            /** write relation quads */
            if (rel_quads.length!=0) {
                for (const p of parent_buckets) {
                    const rel_out = PATH.join(out_dir, escape(extract_resource_from_uri(p)) + '.ttl')
                    if (exists(rel_out)) {
                        await fs.appendFile(rel_out, new n3.Writer().quadsToString(rel_quads))
                    } else {
                        //rel_quads.push(quad(namedNode(p), RDF.terms.type, TREE.terms.Node))
                        await fs.appendFile(rel_out, new n3.Writer().quadsToString(rel_quads))
                    }
                    /** write relation quads to tree collection */
                    await fs.appendFile(tree_collection_out, new n3.Writer().quadsToString(rel_quads))
                }
            }
        })
        .on('end',()=>{
            console.log(counter)
            treeMemberInputStream.disconnect()
            }
        )

}


