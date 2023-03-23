import {Partial} from "@treecg/bucketizer-core";
import {BucketizerCoreExtOptions} from "../types";

export interface IConfig {
    /** sparql endpoint */
    _config:{[key:string]: any}
    _sparqlEndpoint?: string|undefined
    _sparqlQuery?: string|undefined
    _namespace_iri: string
    _namespace_prefix?: string
    _bucketizerOptions:Partial<BucketizerCoreExtOptions>
    _prefixes?:{[p:string]: string}|undefined

}

export const N3FormatTypes = <const>[
    "Turtle",
    "application/trig",
    "N-Triples",
    "N-Quads",
]


