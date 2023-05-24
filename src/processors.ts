import { QueryEngine } from "@comunica/query-sparql";
import {Config, getConfig} from "./parseConfig";
import * as n3 from "n3";
import {RDF, SDS, TREE} from "@treecg/types";
import {DataFactory} from "n3";
import namedNode = DataFactory.namedNode;
import {TreeCollection, TreeNode} from "./tree";
import { Stream, Writer } from "@treecg/connector-types";
import {Quad} from "@rdfjs/types";
import quad = DataFactory.quad;
import PATH from "path";
import {
    createDir,
    escape,
    exists,
    extract_resource_from_uri,
    isTreeCollection, n3Escape,
    treeCollectionID,
    treeNodeID
} from "./utils";
import * as fs from "graceful-fs";

const queryEngine = new QueryEngine();

function serialize_quads(quads: Quad[]): string {
  return new n3.Writer().quadsToString(quads);
}

/**
 * The query_sparql processor fetches query result from a SPRAQL endpoint
 * @param configPath PATH to a config file. For example, ./config.json
 * @param writer a stream writer instance
 */
export async function querySparql(configPath: string, writer: Writer<string>) {
  const config: Config = getConfig(configPath);
  await config.setup();

  // const quadStream = await queryEngine.queryQuads(config.sparqlQuery, { sources: [config.sparqlEndpoint] });
  // const quads = await quadStream.toArray()
  // await writer.push(serialize_quads(quads));

    doQuery(config, writer)
}

async function doQuery(config: Config, writer: Writer<string>){
    await new Promise(res => setTimeout(res, 3000))
    const quadStream = await queryEngine.queryQuads(config.sparqlQuery, { sources: [config.sparqlEndpoint] });
    const quads = await quadStream.toArray()
    await writer.push(serialize_quads(quads));
}

/**
 * The sds_to_tree processor transforms SDS data streamed from bucketization into a TREE index
 * @param configPath PATH to a config file. For example, ./config.json
 * @param reader Readable stream
 * @param tree_node_writer Writeable stream
 * @param tree_collection_writer writeable stream
 */
export async function sds_to_tree(configPath:string,
                            reader:Stream<Quad[]>,
                            treeNodeOutputStream:Writer<string>,
                            treeCollectionOutputStream:Writer<string>) {

    const config = getConfig(configPath)
    const tree_collection_store = new n3.Store()
    const tree_collection = new TreeCollection(namedNode(config.namespaceIRI),configPath, tree_collection_store, false,false)
    reader
        .on('data', async quads => {
            // array of quads instead of QuadString
            // transform SDS bucket to TREE node
            const tree_node_store = new n3.Store()
            tree_node_store.addQuads(quads);
            const nodes = [...tree_node_store.getObjects(null, namedNode(SDS.bucket),null)]
            if(nodes.length>1) console.log('Multiple nodes detected for a member')
            const node_id = nodes.pop()
            if (node_id) {
                const node_ins = new TreeNode(namedNode(config.bucketizerOptions.bucketBase+n3Escape(node_id.value)), configPath, tree_node_store)
                // move showTreeMember to config
                if (tree_collection.showTreeMember) tree_collection.addMembers(node_ins.members)
                // only index relations directly associated with root node
                if (tree_node_store.has(quad(tree_collection.root_node, namedNode(SDS.relation), node_id))) {
                    tree_collection.addRelations(node_ins.rootRelation)
                }
                await treeNodeOutputStream.push(serialize_quads(node_ins.quads))
            }
            else
                // caution: an opName e.g. Faisceau Impair may point to multiple uopid
                console.log("ERROR: detected a member has no Bucket!", quads)
        })
        .on('end', async () => {
            console.log("SDS_TO_TREE is processed")
            tree_collection.serialization()
            console.log(tree_collection.quads)
            await treeCollectionOutputStream.push(serialize_quads(tree_collection.quads))
        })

}

/**+
 * The ingest processor materialize quads of TREE to files
 * @param configPath PATH to a config file. For example, ./config.json
 * @param treeNodeInputStream readable stream
 * @param treeCollectionInputStreamr readable stream
 */
export async function ingest(configPath: string, treeNodeInputStream: Stream<string>, treeCollectionInputStream: Stream<string>) {
    const config = getConfig(configPath)
    const out_dir = createDir(PATH.resolve('out'))
    treeNodeInputStream
        .on('data', async quadString => {
            const quads = new n3.Parser().parse(quadString)
            console.log(quads)
            const node_id = [...new Set(quads.filter(q => q.predicate.equals(RDF.terms.type)).map(q => q.subject))]
            if (node_id.length > 1) return
            const out = PATH.join(out_dir, escape(extract_resource_from_uri(node_id[0].value))+'.ttl')
            if (exists(out)){
                const tree_node_writer = new n3.Writer()
                const no_node_quads = quads.filter(q => !q.object.equals(TREE.terms.Node))
                tree_node_writer.addQuads(no_node_quads)
                tree_node_writer.end(async (error: any, q) => {
                    await fs.writeFile(out, q, {flag: 'a+'}, (err: any) => {
                        if (err) throw err;
                    })
                });
            }
            else {
                const tree_node_writer = new n3.Writer({prefixes: config.prefixes})
                tree_node_writer.addQuads(quads)
                tree_node_writer.end(async (error: any, q) => {
                    await fs.writeFile(out, q, (err: any) => {
                        if (err) throw err;
                    })
                });
            }
        })
        .on('end',  () => {
            //console.log("done")
        })
    treeCollectionInputStream
        .on('data', async quadString=> {
            const out = PATH.join(out_dir, 'tree_collection.ttl')
            const quads = new n3.Parser().parse(quadString)
            console.log(quads)
            const tree_collection_writer = new n3.Writer({prefixes:config.prefixes})
            tree_collection_writer.addQuads(quads)
            // tree_collection_writer.end( async(error:any, q) => {
            //     await fs.writeFile(out, q, (err:any) => {
            //         if (err) throw err;
            //     })
            // });
        })
        .on('end',  () => {
            console.log("done")
        })
}
