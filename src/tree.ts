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
import {BlankNode, Literal, NamedNode, Quad, Term} from "@rdfjs/types";
import * as n3 from "n3";
import {Store, DataFactory} from "n3";
import quad = DataFactory.quad;
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;
import blankNode = DataFactory.blankNode;
import { escape, extract_resource_from_uri, remainingItemsCount } from "./utils";
import {Config, getConfig} from "./parseConfig";
import * as PATH from "path";
import fs from "fs";
import path from "path";

export class TreeNode implements NodeInterface, SerializationInterface {
  id: NamedNode
  config: Config
  store: n3.Store
  isTreeMember: boolean
  showTreeMember: boolean
  members?: TreeMember[]
  relations?: TreeRelation[]
  sub_nodes?: NamedNode[]
  quads: Quad[]

  constructor(id: NamedNode,
              config:string,
              store:n3.Store,
              isTreeMember: boolean = false,
              showTreeMember: boolean = true) {
    this.id = namedNode(id.value.replace(extract_resource_from_uri(id.value), escape(id.value)))
    this.config = getConfig(config)
    this.store = store
    this.isTreeMember = isTreeMember
    this.showTreeMember = showTreeMember
    this.members = this.addMembers()
    this.relations = this.addRelations()
    this.quads = this.serialize()
  }

  addMembers():TreeMember[]{
    let nodeMembers:TreeMember[] = []

    for (const record of [...this.store.getSubjects(namedNode(SDS.bucket), this.id, null)]) {
      for (const member of [...this.store.getObjects(record, namedNode(SDS.payload), null)]) {
        // list members adheres to a bucket instance
        nodeMembers.push(new TreeMember(namedNode(member.id),
            [...this.store.match(member, null, null)]))
      }
    }
      return nodeMembers
  }
  addRelations():TreeRelation[]{
    const relations = [...this.store.getObjects(this.id, namedNode(SDS.relation), null)]
    let treeNodeRelations: TreeRelation[] = []
    const prop_path = (typeof this.config.propertyPath === 'string') ?
        this.config.propertyPath : this.config.propertyPath[0]
    if (relations.length !== 0) {
      for (const relation of relations) {
        for (const sub_bucket of [...this.store.getObjects(relation, namedNode(SDS.relationBucket), null)]) {
          const resource_bucket = extract_resource_from_uri(sub_bucket.value)
          for (const rel_value of [...this.store.getObjects(relation, namedNode(SDS.relationValue), null)]) {
            treeNodeRelations.push(new TreeRelation(
                <NamedNode|BlankNode>relation,
                RelationType.Substring,
                namedNode(sub_bucket.value.replace(resource_bucket, escape(resource_bucket))),
                <Literal>rel_value,
                namedNode(prop_path),
                remainingItemsCount(this.store, <n3.NamedNode|n3.BlankNode>relation) ))
          }
        }
      }
    }
    return treeNodeRelations
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
  materialize():void{
    const tree_node_writer = new n3.Writer({prefixes:this.config.prefixes})
    tree_node_writer.addQuads(this.quads)
    tree_node_writer.end( (error:any, quads) => {
      const out = PATH.join(PATH.resolve(this.config.path), escape(extract_resource_from_uri(this.id.value))+'.ttl')
      if(!fs.existsSync(PATH.resolve(out)))
        fs.mkdirSync(PATH.resolve(out), {recursive: true})
      fs.writeFile(out, quads, (err:any) =>{
        if (err) throw err;
      });
    })
  }
}

export class TreeCollection extends TreeNode implements CollectionInterface, SerializationInterface {
  shape?: TreeShape
  resource: TreeResource | TreeResource[]
  nodes: any
  constructor(id: NamedNode,
    config:string, store:n3.Store,
    isTreeMember: boolean = false,
    showTreeMember: boolean = false,
  ) {
    super(id, config, store, isTreeMember, showTreeMember);
    this.nodes = this.addNodes()
    this.members = this.addMembers()
    this.relations = this.addRelations()
    this.resource = new TreeResource(this.id, ResourceType['subset'], this.id)
    this.shape = new TreeShape(blankNode(), this.config.bucketizerOptions.propertyPath.map(namedNode))
    this.quads = [...this.serialize(),...this.serialize_metadata()]
    this.materialize()
    this.materialize_nodes()
  }
  addNodes() {
    const all_nodes = [...this.store.getObjects(null, namedNode(SDS.bucket), null)]
    return all_nodes.filter(node => node !== this.id)
  }

  addMembers():TreeMember[]{
    let collectionMembers:TreeMember[]=[];
    for (const bucket of [...this.store.getObjects(null, namedNode(SDS.bucket), null)]) {
      for (const record of [...this.store.getSubjects(namedNode(SDS.bucket), bucket, null)]) {
        for (const member of [...this.store.getObjects(record, namedNode(SDS.payload), null)]){
          collectionMembers.push(new TreeMember(namedNode(member.id),
              [...this.store.match(member, null, null)]))
        }
      }
    }
    return collectionMembers
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

  materialize() {
    const tree_collection_writer = new n3.Writer({prefixes: this.config.prefixes})
    tree_collection_writer.addQuads(this.quads)
    tree_collection_writer.end(async (error: any, quads) => {
      const out = PATH.join(PATH.resolve(this.config.path), 'tree_collection.ttl')
      if (!fs.existsSync(PATH.resolve(out)))
        fs.mkdirSync(PATH.resolve(out), {recursive: true})
      fs.writeFile(out, quads, (err: any) => {
        if (err)
          throw err;
      });
    })
  }
  materialize_nodes(){
    for (const node of this.nodes){
      const node_writer = new n3.Writer(this.config.prefixes)
      const node_ins = new TreeNode(node, this.config.configPath, this.store,false, true)
      node_writer.addQuads(node_ins.quads)
      node_writer.end(async (error: any, quads) => {
        const out = PATH.join(PATH.resolve(this.config.path), escape(extract_resource_from_uri(node_ins.id.value)) + '.ttl')
        if (!fs.existsSync(PATH.resolve(out)))
          fs.mkdirSync(PATH.resolve(out), {recursive: true})
        fs.writeFile(out, quads, (err: any) => {
          if (err)
            throw err;
        });
      })
    }
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
