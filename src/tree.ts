import {
  CollectionInterface,
  NodeInterface,
  ResourceInterface,
  ShapeInterface,
  MemberInterface,
  RelationInterface,
  RelationType,
  SerializationInterface,
  ResourceType
} from "./types";
import { RDF, SDS, SHACL, TREE } from "../../types";
import { BlankNode, Dataset, Literal, NamedNode, Quad, Term } from "@rdfjs/types";
import { DataFactory, Store } from "n3";
import quad = DataFactory.quad;
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;
import blankNode = DataFactory.blankNode;
import { add_quad } from "./n3_utils";
import { escape, extract_resource_from_uri, remainingItemsCount } from "./utils";
import { Config } from "./parseConfig";


export class TreeNode implements NodeInterface, SerializationInterface {
  id: NamedNode
  isTreeMember: boolean
  showTreeMember: boolean
  prefixes: { [key: string]: string }
  members?: TreeMember[]
  relations?: TreeRelation[]
  quads: Quad[]

  constructor(id: NamedNode, isTreeMember: boolean = false, showTreeMember: boolean = true, prefixes: { [key: string]: string } = {}, members?: TreeMember[], relations?: TreeRelation[]) {
    this.id = namedNode(id.value.replace(extract_resource_from_uri(id.value), escape(id.value)))
    this.isTreeMember = isTreeMember
    this.showTreeMember = showTreeMember
    this.prefixes = prefixes
    this.members = members
    this.relations = relations
    this.quads = this.serialize()
  }

  serialize(): Quad[] {
    let node_quads: Quad[] = []
    /**
     * tree:Node --> tree:Relation
     *
     */
    if (this.relations !== undefined && this.relations.length !== 0) {
      for (const rel of this.relations) {
        //tree:Node tree:relation tree:Relation.
        node_quads.push(quad(this.id, namedNode(TREE.relation), rel.id))
        node_quads = [...node_quads, ...rel.quads]
      }
    }
    /**
     * tree:member(s)
     * When isTreeMember is set to false by default, no link between tree:members and tree:node .
     * They are self-contained members within a fragment/tree:Node.
     */
    if (this.showTreeMember) {
      if (this.members !== undefined) {
        for (const member of this.members) {
          if (this.isTreeMember) {
            node_quads.push(quad(this.id, namedNode(TREE.member), member.id))
          }
          node_quads = [...node_quads, ...member.quads]
        }
      }
    }
    return node_quads
  }
}

export class TreeCollection extends TreeNode implements CollectionInterface, SerializationInterface {
  shape?: TreeShape
  resource: TreeResource | TreeResource[]
  metadata_quads: Quad[]
  bucket_root: string;
  constructor(id: NamedNode,
    isTreeMember: boolean = false,
    showTreeMember: boolean = false,
    prefixes: { [key: string]: string },
    resource: TreeResource,
    bucket_root: string,
    members?: TreeMember[],
    relations?: TreeRelation[],
    shape?: TreeShape,
  ) {
    super(id, isTreeMember, showTreeMember, prefixes, members, relations);
    this.resource = resource
    this.shape = shape
    this.metadata_quads = this.serialize_metadata()

    /// Write this data to the file

    this.bucket_root = bucket_root;
  }


  async handle_sds_member(store: Store, config: Config) {
    for (const relation of [...store.getObjects(namedNode(this.bucket_root), namedNode(SDS.relation), null)]) {
      /**
       * as the mapping ratio between a tree:Relation instance and tree:Node/sds:Bucket through sds:relationBucket
       * is 1 to 1, we only expect the following loop iterates once.
       */
      for (const bucket of [...store.getObjects(relation, namedNode(SDS.relationBucket), null)]) {
        const prop_path_ins = namedNode((typeof config.bucketizerOptions.propertyPath === 'string') ?
          config.bucketizerOptions.propertyPath : config.bucketizerOptions.propertyPath[0])
        const relation_ins =
          new TreeRelation(<BlankNode>relation,
            RelationType['Substring'],
            <NamedNode>bucket,
            <Literal[]>[...store.getObjects(<BlankNode>relation, namedNode(SDS.relationValue), null)],
            prop_path_ins,
            <number>remainingItemsCount(store, <Term>relation))

        /// Write this relation to the correct file or something
      }
    }
  }


  serialize_metadata() {
    let md_quads: Quad[] = []
    /** TREE metadata */
    // Resource rdf:type tree:Collection.
    md_quads.push(quad(this.id, namedNode(RDF.type), namedNode(TREE.Collection)))
    // adding resources
    if (this.resource instanceof Array) {
      for (const r of this.resource) {
        md_quads.push(quad(this.id, namedNode(r.resourceType), r.resource))
      }
    }
    else
      md_quads.push(quad(this.id, namedNode(this.resource.resourceType), this.resource.resource))
    // adding shape

    if (this.shape !== undefined) {
      const tree_shape_blank = blankNode()
      md_quads.push(quad(this.id, namedNode(TREE.shape), tree_shape_blank))
      md_quads = [...md_quads, ...this.shape.quads]
    }
    return md_quads
  }
}

export class TreeMember implements MemberInterface {
  id: NamedNode | BlankNode;
  quads: Quad[];
  constructor(id: NamedNode | BlankNode, quads: Quad[]) {
    this.id = id
    this.quads = quads
  }
}

export class TreeRelation implements RelationInterface, SerializationInterface {
  /** relation URI */
  id: NamedNode | BlankNode
  /** relation type see sds:relationType */
  type: RelationType
  /** target node/bucket for a relation see: sds:relationBucket*/
  relation_node: NamedNode | BlankNode
  /** relation value see: sds:relationValue and tree:value */
  value?: Literal | Literal[]
  /** relation (property) path(s) see sds:relationPath or tree:path */
  path?: NamedNode | BlankNode
  /** remaining items underneath a relation */
  remainingItems?: number
  quads: Quad[]
  constructor(id: NamedNode | BlankNode,
    type: RelationType,
    relation_node: NamedNode | BlankNode,
    value?: Literal | Literal[],
    path?: NamedNode | BlankNode,
    remainingItems?: number) {
    this.id = id
    this.type = type
    this.relation_node = relation_node
    this.value = value
    this.path = path
    this.remainingItems = remainingItems
    this.quads = this.serialize()
  }
  serialize() {
    let rel_quads: Quad[] = []
    /** Relation quads serialization
     * tree:Node tree:relation tree:Relation.
     * tree:Relation tree:path Literal;
     * tree:Relation tree:value Literal;
     * tree:Relation tree:node NamedNode;
     * tree:Relation tree:remainingItems Literal;
     */
    //tree:Relation rdf:type tree:RelationType.
    rel_quads.push(quad(this.id, namedNode(RDF.type), namedNode(this.type)))
    //tree:Relation tree:path IRI.
    if (this.path! instanceof Array)
      for (const rel_path of this.path)
        this.quads.push(quad(this.id, namedNode(TREE.path), <NamedNode>rel_path))
    else
      rel_quads.push(quad(<BlankNode>this.id, namedNode(TREE.path), <NamedNode>this.path))
    //tree:Relation tree:value Literal.
    if (this.value! instanceof Array)
      for (const rel_val of this.value)
        rel_quads.push(quad(this.id, namedNode(TREE.value), <Literal>rel_val))
    else
      rel_quads.push(quad(this.id, namedNode(TREE.value), <Literal>this.value))
    //tree:Relation tree:node tree:Node.
    rel_quads.push(quad(this.id, namedNode(TREE.node), this.relation_node))
    //tree:Relation tree:remainingItems Literal.
    rel_quads.push(quad(this.id, namedNode(TREE.remainingItems), literal(<number>this.remainingItems)))
    return rel_quads
  }
}

export class TreeResource implements ResourceInterface {
  collection: NamedNode | BlankNode
  resourceType: ResourceType
  resource: NamedNode | BlankNode
  quads: Quad[]
  constructor(collection: NamedNode | BlankNode, resourceType: ResourceType, resource: NamedNode | BlankNode) {
    this.collection = collection
    this.resourceType = resourceType
    this.resource = resource
    this.quads = this.serialize()
  }
  serialize() {
    let res_quads: Quad[] = []
    /**
     * TreeResource quads serialization
     *
     * tree:Collection tree:view|void:subset|dcterms:isPartOf tree:Node|tree:Collection.
     */
    res_quads.push(quad(this.collection, namedNode(this.resourceType), this.resource))
    return res_quads
  }
}

export class TreeShape implements ShapeInterface, SerializationInterface {
  shape: NamedNode | BlankNode
  path: NamedNode | NamedNode[]
  quads: Quad[]
  // do we want to limit the number of paths to 2?
  constructor(shape: NamedNode | BlankNode, path: NamedNode | NamedNode[]) {
    this.shape = shape
    this.path = path
    this.quads = this.serialize()
  }
  serialize() {
    let shape_quads: Quad[] = []
    const sh_prop_blank = blankNode(),
      sh_path_blank = blankNode()
    shape_quads.push(quad(this.shape, namedNode(SHACL.property), sh_prop_blank))
    shape_quads.push(quad(sh_prop_blank, namedNode(SHACL.minCount), literal(1)))
    if (this.path instanceof Array) {
      shape_quads.push(quad(sh_prop_blank, namedNode(SHACL.path), sh_path_blank))
      let sh_alt_path_blank = blankNode()
      shape_quads.push(quad(sh_path_blank, namedNode(SHACL.alternativePath), sh_alt_path_blank))
      for (let i = 0; i < this.path.length; i++) {
        shape_quads.push(quad(sh_alt_path_blank, namedNode(RDF.first), this.path[i]))
        let rdf_rest_blank = blankNode()
        if (i != this.path.length - 1)
          shape_quads.push(quad(sh_alt_path_blank, namedNode(RDF.rest), rdf_rest_blank))
        else
          shape_quads.push(quad(sh_alt_path_blank, namedNode(RDF.rest), namedNode(RDF.nil)))
        sh_alt_path_blank = rdf_rest_blank
      }
    }
    else {
      shape_quads.push(quad(sh_prop_blank, namedNode(SHACL.path), this.path))
    }
    return shape_quads
  }
}
