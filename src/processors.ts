import { QueryEngine } from "@comunica/query-sparql";
import {getConfig} from "./parseConfig";
import * as n3 from "n3";
import {SDS} from "@treecg/types";
import {Store, DataFactory} from "n3";

import namedNode = DataFactory.namedNode;
import {TreeCollection, TreeNode} from "./tree";

import { Stream, Writer } from "@treecg/connector-types";
import {Quad} from "@rdfjs/types";
import quad = DataFactory.quad;

const queryEngine = new QueryEngine();


function serialiaze_quads(quads: Quad[]): string {
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
  await writer.push(serialiaze_quads(quads));
}

/**
 * The ingest processor transforms SDS data streamed from bucketization into a TREE index
 * @param configPath PATH to a config file. For example, ./config.json
 * @param reader a stream reader instance
 */
async function ingest(configPath: string, reader: Stream<string>) {
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
        await node_ins.materialize()
      })
      .on('end', async () => {
          tree_collection.serialization()
          await tree_collection.materialize()
      })
}
