"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationType = exports.ResourceType = exports.N3FormatTypes = void 0;
exports.N3FormatTypes = [
    "Turtle",
    "application/trig",
    "N-Triples",
    "N-Quads",
];
var ResourceType;
(function (ResourceType) {
    ResourceType["view"] = "https://w3id.org/tree#";
    ResourceType["subset"] = "http://rdfs.org/ns/void#subset";
    ResourceType["isPartOf"] = "http://purl.org/dc/terms/isPartOf";
})(ResourceType = exports.ResourceType || (exports.ResourceType = {}));
var RelationType;
(function (RelationType) {
    RelationType["Relation"] = "https://w3id.org/tree#Relation";
    RelationType["Substring"] = "https://w3id.org/tree#SubstringRelation";
    RelationType["Prefix"] = "https://w3id.org/tree#PrefixRelation";
    RelationType["Suffix"] = "https://w3id.org/tree#SuffixRelation";
    RelationType["GreaterThan"] = "https://w3id.org/tree#GreaterThanRelation";
    RelationType["GreaterThanOrEqualTo"] = "https://w3id.org/tree#GreaterThanOrEqualToRelation";
    RelationType["LessThan"] = "https://w3id.org/tree#LessThanRelation";
    RelationType["LessThanOrEqualTo"] = "https://w3id.org/tree#LessThanOrEqualToRelation";
    RelationType["EqualThan"] = "https://w3id.org/tree#EqualThanRelation";
    RelationType["GeospatiallyContains"] = "https://w3id.org/tree#GeospatiallyContainsRelation";
})(RelationType = exports.RelationType || (exports.RelationType = {}));
