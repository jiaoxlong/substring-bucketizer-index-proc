"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeNodeTransform = exports.TreeCollectionTransform = void 0;
const stream_1 = require("stream");
/**
 * read and write TreeCollection objects in a tranform stream
 */
class TreeCollectionTransform extends stream_1.Transform {
    constructor(options) {
        super(Object.assign(Object.assign({}, options), { readableObjectMode: true, writableObjectMode: true }));
    }
    _transform(chunk, _, callback) {
        const quads = chunk.quads;
        this.push(quads);
        callback();
    }
}
exports.TreeCollectionTransform = TreeCollectionTransform;
/**
 * read and write TreeNode objects in a tranform stream
 */
class TreeNodeTransform extends stream_1.Transform {
    constructor(options) {
        super(Object.assign(Object.assign({}, options), { readableObjectMode: true, writableObjectMode: true }));
    }
    _transform(chunk, _, callback) {
        const quads = chunk.quads;
        this.push(quads);
        callback();
    }
}
exports.TreeNodeTransform = TreeNodeTransform;
