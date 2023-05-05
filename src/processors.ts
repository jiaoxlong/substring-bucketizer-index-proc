import { QueryEngine } from "@comunica/query-sparql";
import {getConfig} from "./parseConfig";
import * as n3 from "n3";
import {SDS} from "@treecg/types";
import {DataFactory} from "n3";
import namedNode = DataFactory.namedNode;
import {TreeCollection, TreeNode} from "./tree";
import { Stream, Writer } from "@treecg/connector-types";
import {Quad} from "@rdfjs/types";
import quad = DataFactory.quad;
import PATH from "path";
import {escape, extract_resource_from_uri, isTreeCollection, treeCollectionID} from "./utils";
import fs from "fs";

const queryEngine = new QueryEngine();


function serialize_quads(quads: Quad[]): string {
  return new n3.Writer().quadsToString(quads);
}


/**
 * The query_sparql processor fetches query result from a SPRAQL endpoint
 * @param configPath PATH to a config file. For example, ./config.json
 * @param writer a stream writer instance
 */
export async function query_sparql(configPath: string, writer: Writer<string>) {
  const config = getConfig(configPath);
  const quadStream = await queryEngine.queryQuads(config.sparqlQuery, { sources: [config.sparqlEndpoint] });
  const quads = await quadStream.toArray();
  await writer.push(serialize_quads(quads));
}

/**
 * The sds_to_tree processor transforms SDS data streamed from bucketization into a TREE index
 * @param configPath PATH to a config file. For example, ./config.json
 * @param reader Readable stream
 * @param tree_node_writer Writeable stream
 * @param tree_collection_writer writeable stream
 */
export function sds_to_tree(configPath:string,
                            reader:Stream<string>,
                            tree_node_writer:Writer<string>,
                            tree_collection_writer:Writer<string>) {

    const config = getConfig(configPath)
    const store = new n3.Store()
    const tree_collection = new TreeCollection(namedNode(config.namespaceIRI),configPath, store, false,false)
    reader
        .on('data', async quadString => {
            // transform SDS bucket to TREE node
            const quads = new n3.Parser().parse(quadString);
            store.addQuads(quads);
            const node_id = [...store.getObjects(null, namedNode(SDS.bucket),null)].pop()
            const node_ins = new TreeNode(namedNode(node_id!.value),configPath, store)
            // move showTreeMember to config
            if (tree_collection.showTreeMember) tree_collection.addMembers(node_ins.members)
            // only index relations directly associated with root node
            if (store.has(quad(tree_collection.root_node, namedNode(SDS.relation), node_id!)))
                tree_collection.addRelations(node_ins.relations)
            await tree_node_writer.push(serialize_quads(node_ins.quads))
        })
        .on('end', async () => {
            tree_collection.serialization()
            await tree_collection_writer.push(serialize_quads(tree_collection.quads))
        })

}

/**+
 * The ingest processor materialize quads of TREE to files
 * @param configPath PATH to a config file. For example, ./config.json
 * @param tree_node_reader readable stream
 * @param tree_collection_reader readable stream
 */
async function ingest(configPath: string, tree_node_reader: Stream<string>, tree_collection_reader: Stream<string>) {
    const config = getConfig(configPath)

    tree_node_reader
        .on('data', async quadString => {
            let is_tree_node:boolean = true
            const quads = new n3.Parser().parse(quadString)
            const tree_writer = new n3.Writer({prefixes:config.prefixes})
            let out:string
            // quads of a tree node or a tree collection?
            if (isTreeCollection(quadString)){
                const out = PATH.join(PATH.resolve(config.path), 'tree_collection.ttl')
            }
            else {
                const out = PATH.join(PATH.resolve(config.path), escape(extract_resource_from_uri(treeCollectionID(quadString))) + '.ttl')
            }
            tree_writer.addQuads(quads)
            tree_writer.end( async(error:any, q) => {
                if(!fs.existsSync(PATH.resolve(out)))
                    fs.mkdirSync(PATH.resolve(out), {recursive: true})
                await fs.writeFile(out, q, (err:any) => {
                    if (err) throw err;
                })
            });
        })
        .on('end',  () => {
            console.log("done")
         })
}
