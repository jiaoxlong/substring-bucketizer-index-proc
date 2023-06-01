"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toQuad = exports.add_quad = exports.n3_quad_object_to_subject = void 0;
const n3_1 = require("n3");
var quad = n3_1.DataFactory.quad;
/**
 * extract the object from a Quad and cast it to type Quad_Subject
 * @param quad: Quad
 * @returns Quad_Subject
 */
function n3_quad_object_to_subject(quad) {
    if (quad.object instanceof (n3_1.NamedNode && n3_1.BlankNode))
        return quad.object;
    else
        throw new Error(`object_to_subject() is only able to extract a Quad object of type NamedNode`);
}
exports.n3_quad_object_to_subject = n3_quad_object_to_subject;
/**
 * add_quad() is an alternative to n3.Writer.addQuad()
 */
function add_quad(writer, subject, predicate, object) {
    writer.addQuad(quad(subject, predicate, object));
}
exports.add_quad = add_quad;
function toQuad(subject, predicate, object) {
    return quad(subject, predicate, object);
}
exports.toQuad = toQuad;
