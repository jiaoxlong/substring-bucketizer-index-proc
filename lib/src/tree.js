"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeShape = exports.TreeResource = exports.TreeRelation = exports.TreeMember = exports.TreeCollection = exports.TreeNode = exports.TreeBaseNode = void 0;
const types_1 = require("./types");
const types_2 = require("@treecg/types");
const n3_1 = require("n3");
var quad = n3_1.DataFactory.quad;
var namedNode = n3_1.DataFactory.namedNode;
var literal = n3_1.DataFactory.literal;
var blankNode = n3_1.DataFactory.blankNode;
const utils_1 = require("./utils");
const parseConfig_1 = require("./parseConfig");
class TreeBaseNode {
    constructor(id, config, store, isTreeMember = false, showTreeMember = false) {
        this.id = id;
        this.config = (0, parseConfig_1.getConfig)(config);
        this.store = store;
        this.isTreeMember = isTreeMember;
        this.showTreeMember = showTreeMember;
        this.members = [];
        this.relations = [];
    }
    addRelation(treeRelation) {
        this.relations.push(treeRelation);
    }
    addMember(treeMember) {
        this.members.push(treeMember);
    }
    serialize() {
        let quads = [];
        /**
         * add relation quads
         */
        if (this.relations.length !== 0) {
            for (const rel of this.relations) {
                //tree:Node tree:relation tree:Relation.
                console.log(quad(this.id, namedNode(types_2.TREE.relation), rel.id));
                quads.push(quad(this.id, namedNode(types_2.TREE.relation), rel.id));
                quads = quads.concat(rel.quads);
            }
        }
        /**
         * add member quads
         */
        if (this.showTreeMember && this.members.length !== 0) {
            for (const member of this.members) {
                quads = quads.concat(member.quads);
            }
        }
        return quads;
    }
}
exports.TreeBaseNode = TreeBaseNode;
class TreeNode extends TreeBaseNode {
    constructor(id, config, store, isTreeMember = false, showTreeMember = true) {
        super(id, config, store, isTreeMember, showTreeMember);
        this.members = this.showTreeMember ? this.addMembers() : [];
        this.rootRelationQuads = [];
        this.relations = this.addRelations();
        this.quads = this.serialize();
        // todo: handle the additional quad with serialize()?
        this.quads.push(quad(this.id, types_2.RDF.terms.type, types_2.TREE.terms.Node));
    }
    addRelations() {
        let treeNodeRelations = [];
        if (this.store.size !== 0) {
            //check if root relation presents in the store
            const rootRel = [...this.store.getQuads(null, types_2.SDS.terms.custom("isRoot"), null, null)];
            if (rootRel.length !== 0) {
                for (const rel of rootRel) {
                    const rels = [...this.store.getQuads(rel.subject, types_2.SDS.terms.relation, null, null)];
                    for (const r of rels) {
                        this.rootRelationQuads.push(quad((0, utils_1.addBucketBase)(this.config, r.subject), types_2.TREE.terms.relation, r.object));
                    }
                }
            }
            const relations = [...this.store.getObjects(null, types_2.SDS.terms.relation, null)];
            if (relations.length !== 0) {
                for (const relation of relations) {
                    treeNodeRelations.push((0, utils_1.createTreeRelation)(relation, this.config, this.store));
                }
            }
        }
        return treeNodeRelations;
    }
    addMembers() {
        let nodeMembers = [];
        for (const record of [...this.store.getSubjects(namedNode(types_2.SDS.bucket), namedNode((0, utils_1.extract_resource_from_uri)(this.id.value)), null)]) {
            for (const member of [...this.store.getObjects(record, namedNode(types_2.SDS.payload), null)]) {
                // list members adheres to a bucket instance
                nodeMembers.push(new TreeMember(namedNode(member.id), [...this.store.match(member, null, null)]));
            }
        }
        return nodeMembers;
    }
}
exports.TreeNode = TreeNode;
class TreeCollection extends TreeBaseNode {
    constructor(id, config, store, isTreeMember = false, showTreeMember = false) {
        super(id, config, store, isTreeMember, showTreeMember);
        this.root_node = (this.config.bucketizerOptions.root === '') ? namedNode(this.config.bucketizerOptions.bucketBase + 'root') :
            namedNode(this.config.bucketizerOptions.bucketBase + this.config.bucketizerOptions.root);
        this.quads = [];
        this.resource = new TreeResource(this.id, types_1.ResourceType['subset'], this.id);
        this.shape = new TreeShape(blankNode(), namedNode(this.config.bucketizerOptions.propertyPath));
    }
    addRelations(treeRelations) {
        this.relations = this.relations.concat(treeRelations);
    }
    serialization() {
        this.quads = this.quads.concat([...this.serialize(), ...this.serialize_metadata()]);
    }
    addMembers(treeMembers) {
        this.members = this.members.concat(treeMembers);
    }
    serialize_metadata() {
        let md_quads = [];
        /** TREE metadata */
        // Resource rdf:type tree:Collection.
        md_quads.push(quad(this.id, types_2.RDF.terms.type, types_2.TREE.terms.Collection));
        // adding resources
        if (this.resource instanceof Array) {
            for (const r of this.resource) {
                md_quads.push(quad(this.id, namedNode(r.resourceType), r.resource));
            }
        }
        else
            md_quads.push(quad(this.id, namedNode(this.resource.resourceType), this.resource.resource));
        // adding shape
        if (this.shape !== undefined) {
            md_quads.push(quad(this.id, namedNode(types_2.TREE.shape), this.shape.shape));
            md_quads = [...md_quads, ...this.shape.quads];
        }
        return md_quads;
    }
}
exports.TreeCollection = TreeCollection;
class TreeMember {
    constructor(id, quads) {
        this.id = id;
        this.quads = quads;
    }
}
exports.TreeMember = TreeMember;
class TreeRelation {
    constructor(id, type, relation_node, value, path, remainingItems) {
        this.id = id;
        this.type = type;
        this.relation_node = relation_node;
        this.value = value;
        this.path = path;
        this.remainingItems = remainingItems;
        this.quads = this.serialize();
    }
    serialize() {
        let rel_quads = [];
        /** Relation quads serialization
         * tree:Node tree:relation tree:Relation.
         * tree:Relation tree:path Literal;
         * tree:Relation tree:value Literal;
         * tree:Relation tree:node NamedNode;
         * tree:Relation tree:remainingItems Literal;
         */
        //tree:Relation rdf:type tree:RelationType.
        rel_quads.push(quad(this.id, namedNode(types_2.RDF.type), namedNode(this.type)));
        //tree:Relation tree:path IRI.
        if (this.path instanceof Array)
            for (const rel_path of this.path)
                this.quads.push(quad(this.id, namedNode(types_2.TREE.path), rel_path));
        else
            rel_quads.push(quad(this.id, namedNode(types_2.TREE.path), this.path));
        //tree:Relation tree:value Literal.
        if (this.value instanceof Array)
            for (const rel_val of this.value)
                rel_quads.push(quad(this.id, namedNode(types_2.TREE.value), rel_val));
        else
            rel_quads.push(quad(this.id, namedNode(types_2.TREE.value), this.value));
        //tree:Relation tree:node tree:Node.
        console.log(quad(this.id, namedNode(types_2.TREE.node), this.relation_node));
        rel_quads.push(quad(this.id, namedNode(types_2.TREE.node), this.relation_node));
        //tree:Relation tree:remainingItems Literal.
        if (this.remainingItems)
            rel_quads.push(quad(this.id, namedNode(types_2.TREE.remainingItems), literal(this.remainingItems)));
        return rel_quads;
    }
}
exports.TreeRelation = TreeRelation;
class TreeResource {
    constructor(collection, resourceType, resource) {
        this.collection = collection;
        this.resourceType = resourceType;
        this.resource = resource;
        this.quads = this.serialize();
    }
    serialize() {
        let res_quads = [];
        /**
         * TreeResource quads serialization
         *
         * tree:Collection tree:view|void:subset|dcterms:isPartOf tree:Node|tree:Collection.
         */
        res_quads.push(quad(this.collection, namedNode(this.resourceType), this.resource));
        return res_quads;
    }
}
exports.TreeResource = TreeResource;
class TreeShape {
    // do we want to limit the number of paths to 2?
    constructor(shape, path) {
        this.shape = shape;
        this.path = path;
        this.quads = this.serialize();
    }
    serialize() {
        let shape_quads = [];
        const sh_prop_blank = blankNode(), sh_path_blank = blankNode();
        shape_quads.push(quad(this.shape, namedNode(types_2.SHACL.property), sh_prop_blank));
        shape_quads.push(quad(sh_prop_blank, namedNode(types_2.SHACL.minCount), literal(1)));
        if (this.path instanceof Array) {
            shape_quads.push(quad(sh_prop_blank, namedNode(types_2.SHACL.path), sh_path_blank));
            let sh_alt_path_blank = blankNode();
            shape_quads.push(quad(sh_path_blank, namedNode(types_2.SHACL.alternativePath), sh_alt_path_blank));
            for (let i = 0; i < this.path.length; i++) {
                shape_quads.push(quad(sh_alt_path_blank, namedNode(types_2.RDF.first), this.path[i]));
                let rdf_rest_blank = blankNode();
                if (i != this.path.length - 1)
                    shape_quads.push(quad(sh_alt_path_blank, namedNode(types_2.RDF.rest), rdf_rest_blank));
                else
                    shape_quads.push(quad(sh_alt_path_blank, namedNode(types_2.RDF.rest), namedNode(types_2.RDF.nil)));
                sh_alt_path_blank = rdf_rest_blank;
            }
        }
        else {
            shape_quads.push(quad(sh_prop_blank, namedNode(types_2.SHACL.path), this.path));
        }
        return shape_quads;
    }
}
exports.TreeShape = TreeShape;
