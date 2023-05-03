import * as n3 from "n3";
import {Partial} from "@treecg/bucketizer-core";
import {BucketizerCoreExtOptions} from "@treecg/types";
import {BlankNode, Literal, NamedNode, Quad, Term} from "@rdfjs/types";
import {TreeCollection, TreeMember, TreeNode, TreeRelation, TreeResource, TreeShape} from './tree'
import {Config} from "./parseConfig";

export interface IConfig {
    /** sparql endpoint */
    _config:{[key:string]: any}
    _configPath:string
    _sparqlEndpoint?: string|undefined
    _sparqlQuery?: string|undefined
    _namespace_iri: string
    _namespace_prefix?: string
    _bucketizerOptions:Partial<BucketizerCoreExtOptions>
    _propertyPath:string[]|string
    _prefixes?:{[p:string]: string}|undefined
    _path?:string|undefined

}

export const N3FormatTypes = <const>[
    "Turtle",
    "application/trig",
    "N-Triples",
    "N-Quads",
]

export interface SerializationInterface {
    serialize():Quad[]
}

export interface MaterializationInterface{
    materialize():Promise<any>
}

/**
 * Todo: integrate types into Treecg/types
 */

export interface BaseNodeInterface{
    id: NamedNode
    config:Config
    store:n3.Store
    isTreeMember:boolean
    showTreeMember:boolean
    members:TreeMember[]
    relations:TreeRelation[]
}
export interface NodeInterface extends BaseNodeInterface {
    quads:Quad[]
}

/**
 * Todo: integrate Collection into Treecg/types
 */
export interface CollectionInterface extends BaseNodeInterface{
    root_node:NamedNode
    shape?:TreeShape,
    resource:TreeResource|TreeResource[]
    serialize_metadata():Quad[]
}

export interface ResourceInterface{
    resourceType: ResourceType,
    resource:NamedNode|BlankNode
}

export interface ShapeInterface{
    /**
     * Shacl shape validation
     * package rdf-validate-shacl
     * new SHACLValidator(nodeShape, { factory })
     */
    //nodeShape:Dataset
    shape:NamedNode|BlankNode
    path:NamedNode|NamedNode[]
    quads:Quad[]
}

export enum ResourceType{
    view = 'https://w3id.org/tree#',
    subset = 'http://rdfs.org/ns/void#subset',
    isPartOf = 'http://purl.org/dc/terms/isPartOf'
}

export interface MemberInterface {
    id: NamedNode|BlankNode;
    quads: Quad[];
}

/**
 * Tree relation interface
 * todo: merge with RelationParameters
 */
export interface RelationInterface {
    /** relation URI */
    id: NamedNode | BlankNode
    /** relation type see sds:relationType */
    type: RelationType
    /** target bucket for a relation see: sds:relationBucket*/
    relation_node: NamedNode
    /** relation value see: sds:relationValue and tree:value */
    value?: Literal | Literal[]
    /** relation (property) path(s) see sds:relationPath or tree:path */
    path?: NamedNode | BlankNode
    /** remaining items underneath a relation */
    remainingItems?: number
    quads:Quad[]
    serialize():Quad[]
}

export enum RelationType {
    Relation = 'https://w3id.org/tree#Relation',
    Substring = 'https://w3id.org/tree#SubstringRelation',
    Prefix = 'https://w3id.org/tree#PrefixRelation',
    Suffix = 'https://w3id.org/tree#SuffixRelation',
    GreaterThan = 'https://w3id.org/tree#GreaterThanRelation',
    GreaterThanOrEqualTo = 'https://w3id.org/tree#GreaterThanOrEqualToRelation',
    LessThan = 'https://w3id.org/tree#LessThanRelation',
    LessThanOrEqualTo = 'https://w3id.org/tree#LessThanOrEqualToRelation',
    EqualThan = 'https://w3id.org/tree#EqualThanRelation',
    GeospatiallyContains = 'https://w3id.org/tree#GeospatiallyContainsRelation'
}

export interface SubstringRelation extends RelationInterface{
    /** constant Substring type relation */
    type: RelationType.Substring
    /** a regular expression to match the string against see sh:pattern */
    pattern?: string
    /** an optional string of flags e.g. "i" for case-insensitive */
    flag?:string
}

