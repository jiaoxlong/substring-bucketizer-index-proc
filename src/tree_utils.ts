import {Transform, TransformCallback, TransformOptions} from "stream";
import {TreeCollection} from "./tree";


/**
 * read and write TreeCollection objects in a tranform stream
 */
export class TreeCollectionTransform extends Transform{
    constructor(options?: TransformOptions){
        super({ ...options, readableObjectMode: true, writableObjectMode: true})
    }
    _transform(chunk:TreeCollection, _:string, callback: TransformCallback){
        const quads = chunk.quads
        this.push(quads)
        callback()
    }
}

/**
 * read and write TreeNode objects in a tranform stream
 */

export class TreeNodeTransform extends Transform{
    constructor(options?: TransformOptions){
        super({ ...options, readableObjectMode: true, writableObjectMode: true})
    }
    _transform(chunk:TreeCollection, _:string, callback: TransformCallback){
        const quads = chunk.quads
        this.push(quads)
        callback()
    }
}
