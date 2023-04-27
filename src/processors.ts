import { QueryEngine } from "@comunica/query-sparql";
import {Config, getConfig} from "./parseConfig";
import * as n3 from "n3";
import { SubstringBucketizer } from "@treecg/substring-bucketizer";
import { exists, extract_resource_from_uri, remainingItemsCount, writerToFile, escape } from "./utils";
import type { AsyncIterator } from 'asynciterator';
import { Partial } from "@treecg/bucketizer-core";
import { BucketizerCoreExtOptions } from "@treecg/types";
import {Store, DataFactory} from "n3";

import namedNode = DataFactory.namedNode;
import blankNode = DataFactory.blankNode;
import { TreeCollection } from "./tree";

import { Stream, Writer } from "@treecg/connector-types";
import {BlankNode, Literal, NamedNode, Quad, Term} from "@rdfjs/types";

const queryEngine = new QueryEngine();

/**
 * a process fetches query result from a SPRAQL endpoint defined in a Bucketizer index config file.
 */

function serialiaze_quads(quads: Quad[]): string {
  return new n3.Writer().quadsToString(quads);
}


export async function query_sparql(configPath: string, writer: Writer<string>) {
  const config = getConfig(configPath);
  const quadStream = await queryEngine.queryQuads(config.sparqlQuery, { sources: [config.sparqlEndpoint] });
  const quads = await quadStream.toArray();
  await writer.push(serialiaze_quads(quads));
}


/**
 * [Obsolete]
 * Use https://github.com/ajuvercr/sds-processors/blob/master/sdsify.ttl
 * arrayify a quad stream to an array of quads
 * @param quad_stream A quad stream
 */

async function quadStreamToArray(quad_stream: AsyncIterator<Quad>): Promise<{ [key: string]: Quad[] }> {
  const quads = await quad_stream.toArray()
  let triple_map: { [key: string]: Quad[] } = {}
  for (const quad of quads) {
    if (!triple_map.hasOwnProperty(quad.subject.value)) {
      triple_map[quad.subject.value] = []
      triple_map[quad.subject.value].push(<Quad>quad);
    } else {
      triple_map[quad.subject.value].push(<Quad>quad)
    }
  }
  return triple_map
}

/**
 * [Obsolete]
 * Use https://github.com/ajuvercr/sds-processors/blob/master/2_bucketstep.ttl
 * creates N3.Store instance with the bucketized quads
 * @param bucketizerOptions
 * @param triple_map an array of bucketized quads
 * @param writeTo when defined, it writes quads into a file with the value (path) assigned to writeTo
 */

function substringBucketize(bucketizerOptions: Partial<BucketizerCoreExtOptions>,
  triple_map: { [key: string]: Quad[] }): Store<any> {

  let rdf: any = [];
  const bucketizer = SubstringBucketizer.build(bucketizerOptions);
  for (const [subject, quads] of Object.entries(triple_map)) {
    rdf.push(bucketizer.bucketize(quads, subject))
    rdf.push(quads)
  }
  return new n3.Store(rdf.flat(2))
}

async function ingest(configPath: string, reader: Stream<string>) {
  const config = getConfig(configPath)
  const tree_collection_node = namedNode(config.namespaceIRI)
  reader.data(async quadString => {
    const quads = new n3.Parser().parse(quadString);
    const store = new n3.Store(quads);
    const collection = new TreeCollection(tree_collection_node, configPath, store);
  })
}
