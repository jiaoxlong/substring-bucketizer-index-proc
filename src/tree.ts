import {
  CollectionInterface,
  NodeInterface,
  ResourceInterface,
  ShapeInterface,
  MemberInterface,
  RelationInterface,
  RelationType,
  SerializationInterface,
  ResourceType, BaseNodeInterface, MaterializationInterface
} from "./types";
import { RDF, SDS, SHACL, TREE } from "@treecg/types";
import * as n3 from "n3";

import {BlankNode, DataFactory, NamedNode, Store, Quad, Literal, Term} from "n3";
import quad = DataFactory.quad;
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;
import blankNode = DataFactory.blankNode;
import {
  addBucketBase,
  createTreeRelation,
  winEscape,
  extract_resource_from_uri,
  getValueByKeyForStringEnum, n3Escape,
  remainingItemsCountStore
} from "./utils";
import {Config, getConfig} from "./parseConfig";
import * as PATH from "path";
import fs from "fs";

export class TreeBaseNode implements BaseNodeInterface, SerializationInterface{
  id: NamedNode
  config: Config
  store: n3.Store
  //When isTreeMember is set to false by default, no link between tree:members and tree:node .
  isTreeMember: boolean
  showTreeMember: boolean
  members:TreeMember[]
  relations: TreeRelation[]
  constructor(id: NamedNode,
              config:string,
              store:n3.Store,
              isTreeMember: boolean = false,
              showTreeMember: boolean = false){
    this.id = id
    this.config = getConfig(config)
    this.store = store
    this.isTreeMember = isTreeMember
    this.showTreeMember = showTreeMember
    this.members = []
    this.relations = []
  }
  addRelation(treeRelation:TreeRelation){
    this.relations.push(treeRelation)
  }
  addMember(treeMember:TreeMember){
    this.members.push(treeMember)
  }
  serialize(): Quad[] {
    let quads: Quad[] = []
    /**
     * add relation quads
     */
    if (this.relations.length !== 0) {
      for (const rel of this.relations) {
        //tree:Node tree:relation tree:Relation.
        console.log(quad(this.id, namedNode(TREE.relation), rel.id))
        quads.push(quad(this.id, namedNode(TREE.relation), rel.id))
        quads = quads.concat(rel.quads)
      }
    }
    /**
     * add member quads
     */

    if (this.showTreeMember && this.members.length !== 0 ) {
      for (const member of this.members) {
        quads = quads.concat(member.quads)
      }
    }
    return quads
  }
}

export class TreeNode extends TreeBaseNode implements NodeInterface{
  rootRelationQuads: Quad[]
  quads: Quad[]
  constructor(id: NamedNode,
              config:string,
              store:n3.Store,
              isTreeMember: boolean = false,
              showTreeMember: boolean = true) {
    super(id, config, store, isTreeMember, showTreeMember);
    this.members = this.showTreeMember ?this.addMembers():[]
    this.rootRelationQuads = []
    this.relations = this.addRelations()
    this.quads = this.serialize()
    // todo: handle the additional quad with serialize()?
    this.quads.push(quad(this.id, RDF.terms.type, TREE.terms.Node))
  }
  addRelations():TreeRelation[]{
    let treeNodeRelations: TreeRelation[] = []
    if(this.store.size!==0) {
      //check if root relation presents in the store

      const rootRel = [...this.store.getQuads(null, SDS.terms.custom("isRoot"), null, null)]
      if (rootRel.length!==0){
        for (const rel of rootRel) {
          const rels = [...this.store.getQuads(rel.subject, SDS.terms.relation, null,null)]
          for (const r of rels) {
            this.rootRelationQuads.push(quad(addBucketBase(this.config, <NamedNode>r.subject), TREE.terms.relation, r.object))
          }
        }
      }
      const relations= [...this.store.getObjects(null, SDS.terms.relation, null)]
      if (relations.length !== 0) {
        for (const relation of relations) {
          treeNodeRelations.push(createTreeRelation(<NamedNode|BlankNode>relation, this.config, this.store))
        }
      }
    }
    return treeNodeRelations
  }
  addMembers():TreeMember[]{
    let nodeMembers:TreeMember[] = []
    for (const record of [...this.store.getSubjects(namedNode(SDS.bucket), namedNode(extract_resource_from_uri(this.id.value)), null)]) {
      for (const member of [...this.store.getObjects(record, namedNode(SDS.payload), null)]) {
        // list members adheres to a bucket instance
        nodeMembers.push(new TreeMember(namedNode(member.id),
            <Quad[]>[...this.store.match(member, null, null)]))
      }
    }
      return nodeMembers
  }
}
export class TreeCollection extends TreeBaseNode implements CollectionInterface{
  root_node: NamedNode
  shape?: TreeShape
  resource: TreeResource | TreeResource[]
  quads: Quad[]
  constructor(id: NamedNode, config:string, store:n3.Store, isTreeMember: boolean = false, showTreeMember: boolean = false){
    super(id, config, store, isTreeMember, showTreeMember)
    this.root_node = (this.config.bucketizerOptions.root === '') ? namedNode(this.config.bucketizerOptions.bucketBase + 'root') :
        namedNode(this.config.bucketizerOptions.bucketBase + this.config.bucketizerOptions.root)
    this.quads = []
    this.resource = new TreeResource(this.id, ResourceType['subset'], this.id)
    this.shape = new TreeShape(blankNode(), namedNode(this.config.bucketizerOptions.propertyPath))

  }
  addRelations(treeRelations:TreeRelation[]){
    this.relations = this.relations.concat(treeRelations)
  }

  serialization(){
    this.quads = this.quads.concat([...this.serialize(),...this.serialize_metadata()])
  }
  addMembers(treeMembers:TreeMember[]){
    this.members = this.members.concat(treeMembers)
  }

  serialize_metadata() {
    let md_quads: Quad[] = []
    /** TREE metadata */
    // Resource rdf:type tree:Collection.
    md_quads.push(quad(this.id, RDF.terms.type, TREE.terms.Collection))
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

      md_quads.push(quad(this.id, namedNode(TREE.shape), this.shape.shape))
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
  relation_node: NamedNode
  /** relation value see: sds:relationValue and tree:value */
  value?: Literal | Literal[]
  /** relation (property) path(s) see sds:relationPath or tree:path */
  path?: NamedNode | BlankNode
  /** remaining items underneath a relation */
  remainingItems?: number
  quads: Quad[]
  constructor(id: NamedNode | BlankNode,
    type: RelationType,
    relation_node: NamedNode ,
    value?: Literal | Literal[],
    path?: NamedNode | BlankNode,
    remainingItems?: number
  )
  {
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
    console.log(quad(this.id, namedNode(TREE.node), this.relation_node))
    rel_quads.push(quad(this.id, namedNode(TREE.node), this.relation_node))
    //tree:Relation tree:remainingItems Literal.
    if (this.remainingItems)
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
