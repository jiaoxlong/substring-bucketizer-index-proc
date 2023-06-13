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
    winEscape,
    exists,
    extract_resource_from_uri, getMemberQuads, getRelationQuads,
    n3_escape, replPredicate, SDSToTree, serialize_quads, remainingItemsQuads,

} from "./utils";
import * as fs from "fs/promises";


const queryEngine = new QueryEngine();

const n3_writer = new n3.Writer()

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
    await quadStream.close()
    await writer.end().then(()=>{ console.log('querySparql: writer stream is closed')})
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
    // reader.on('end',()=>{
    //     treeMemberOutputStream.disconnect()
    // })

    const treeify = async (quads:Quad[]) => {
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
    }
    reader.data(treeify)
    reader.on('end',()=>{
        console.log("sds_to_tree: data is closed");
        treeMemberOutputStream.end()
    })
}

/**+
 * The ingest processor materialize quads of TREE to files
 * @param configPath PATH to a config file. For example, ./config.json
 * @param treeMemberInputStream readable stream
 */
export async function ingest(configPath: string, treeMemberInputStream: Stream<string>) {
    const config = getConfig(configPath)
    const out_dir = createDir(PATH.resolve('out'))
    let counter:{[key:string]: number}= {}
    let counter_index:{[key:string]: any}={}
    const tree_collection = new TreeCollection(namedNode(config.namespaceIRI), configPath, new n3.Store())
    const tree_collection_out = PATH.join(out_dir, 'tree_collection.ttl')
    /** write tree collection meta quads */
    if (!exists(tree_collection_out)) {
        await fs.appendFile(tree_collection_out,
            n3_writer.quadsToString(tree_collection.serialize_metadata()))
    }
    treeMemberInputStream.on('data', async quadString =>{
        const quads = [... new Set(new n3.Parser().parse(quadString))]
        /** member node(s)
         * each chunk of quads is expected to have at least one treeNode
         */
        const buckets = [...new Set(quads.filter(q=>q.predicate.equals(SDS.terms.bucket)).map(q=><NamedNode>q.object))]
        /** member quads */
        const member_quads = getMemberQuads(config, quads)
        /** write member quads */
        for (const b of buckets) {
            const out = PATH.join(out_dir, winEscape(extract_resource_from_uri(b.value)) + '.ttl')
            await fs.appendFile(out, n3_writer.quadsToString(member_quads))
            /** update counter */
            if (b.value in counter){
                counter[b.value] += 1
            }
            else{
                counter[b.value] = 1
            }
            /** relation quads */
            const parent_buckets = [...new Set(quads.filter(q=>q.predicate.equals(TREE.terms.relation)).map(q=>q.subject.value))]
            if (parent_buckets.length !== 0){
                // only one parent bucket is expected; update counter_index
                const parent_bucket = parent_buckets[0]
                const rel_quads  = getRelationQuads(config, parent_bucket, quads, b.value, counter_index)
                const rel_out = PATH.join(out_dir, winEscape(extract_resource_from_uri(parent_bucket)) + '.ttl')
                if (exists(rel_out)) {
                    await fs.appendFile(rel_out, n3_writer.quadsToString(rel_quads))
                } else {
                    await fs.appendFile(rel_out, n3_writer.quadsToString(rel_quads))
                }
                /** write relation quads to tree collection */
                await fs.appendFile(tree_collection_out, n3_writer.quadsToString(rel_quads))
            }
        }
    } )

    treeMemberInputStream.on('end', async()=>{
        for(const b in counter){
            /** write remainingItems quads */
            const path = PATH.join(out_dir, winEscape(extract_resource_from_uri(b)) + '.ttl')
            const remaining_quads_str = n3_writer.quadsToString(remainingItemsQuads(b, counter, counter_index))
            await fs.appendFile(path, remaining_quads_str)
            await fs.appendFile(tree_collection_out, remaining_quads_str)
        }
        console.log('ingest: successfully wrote files.')
    })
}


