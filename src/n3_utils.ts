import {Quad_Subject, DataFactory, Quad, NamedNode, BlankNode, Writer, Term, Quad_Object, Quad_Predicate} from "n3";
import namedNode = DataFactory.namedNode;
import quad = DataFactory.quad;

/**
 * extract the object from a Quad and cast it to type Quad_Subject
 * @param quad: Quad
 * @returns Quad_Subject
 */
export function n3_quad_object_to_subject(quad:Quad):Quad_Subject{
    if (quad.object instanceof (NamedNode && BlankNode))
        return <Quad_Subject>quad.object
    else
        throw new Error(`object_to_subject() is only able to extract a Quad object of type NamedNode`);
}

/**
 * add_quad() is an alternative to n3.Writer.addQuad()
 */

export function add_quad(writer:Writer, subject:NamedNode|BlankNode, predicate:NamedNode, object:Term ){
    writer.addQuad(
        quad(
            <Quad_Subject>subject,
            <Quad_Predicate>predicate,
            <Quad_Object>object
        )
    )
}

export function toQuad(subject:NamedNode|BlankNode, predicate:NamedNode, object:Term){
    return quad(
        <Quad_Subject>subject,
        <Quad_Predicate>predicate,
        <Quad_Object>object)
}
