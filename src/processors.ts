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
    addBucketBase,
    createDir,
    escape,
    exists,
    extract_resource_from_uri,
    isTreeCollection, n3Escape,
    treeCollectionID,
    treeNodeID
} from "./utils";
import * as fs from "fs/promises";

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
    // todo: why ???
    //await treeCollectionOutputStream.push(serialize_quads(tree_collection.serialize_metadata()))
    let counter = 0
    reader
        .on('data', async quads => {
            // array of quads instead of QuadString
            // transform SDS bucket to TREE node
            const tree_node_store = new n3.Store()
            tree_node_store.addQuads(quads);
            const nodes = [...tree_node_store.getObjects(null, namedNode(SDS.bucket),null)]
            console.log(quads)
            console.log(nodes)
            if(nodes.length>1) console.log('Multiple nodes detected for a member')
            const node_id = nodes.pop()
            if (node_id) {
                const node_ins = new TreeNode(addBucketBase(config, namedNode(n3Escape(node_id.value))), configPath, tree_node_store)
                // move showTreeMember to config
                if (tree_collection.showTreeMember) tree_collection.addMembers(node_ins.members)
                await treeNodeOutputStream.push(serialize_quads(node_ins.quads))

                if (node_ins.relations.length !==0){
                    node_ins.showTreeMember = false
                    if (counter ===0 ) {
                        counter++
                        await treeCollectionOutputStream.push(serialize_quads([...node_ins.serialize(), ...node_ins.rootRelationQuads, ...tree_collection.serialize_metadata()]))
                    }
                    else
                        await treeCollectionOutputStream.push(serialize_quads([...node_ins.serialize(), ...node_ins.rootRelationQuads]))
                }
            }
            else
                // caution: an opName e.g. Faisceau Impair may point to multiple uopid
                console.log("ERROR: detected a member has no Bucket!")
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
    let counter:{[key:string]: number}= {}
    const multiply:number = 1000
    treeNodeInputStream
        .on('data', async quadString => {
            const quads = new n3.Parser().parse(quadString)
            const node_id = [...new Set(quads.filter(q => q.predicate.equals(RDF.terms.type)).map(q => q.subject))]
            if (node_id.length > 1) return
            const out = PATH.join(out_dir, escape(extract_resource_from_uri(node_id[0].value))+'.ttl')
            const tree_node_writer = new n3.Writer()
            if (exists(out)){
                delay(counter[out]*multiply).then(async()=>{
                    const no_node_quads = quads.filter(q => !q.object.equals(TREE.terms.Node))
                    await fs.appendFile(out, tree_node_writer.quadsToString(no_node_quads))
                    }
                )
                counter[out] = counter[out]+1
            }
            else {
                counter[out] = 1
                await fs.writeFile(out, tree_node_writer.quadsToString(quads))
            }
        })
    treeCollectionInputStream
        .on('data', async quadString=> {
            // const out = PATH.join(out_dir, 'tree_collection.ttl')
            // if(exists(out)){
            //     delay(100).then(async()=>{
            //         await fs.appendFile(out, quadString)
            //     })
            // }
            // else{
            //     await fs.writeFile(out, quadString)
            // }
        })
        .on('end',  () => {
            console.log("Tree collection is materialized")
        })
}

/**
 * delay() introduce a promise-based delay
 * @param ms millisecond
 */
function delay(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

