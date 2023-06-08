
import {invalidWINRes, invalidWINSYM, isInvalidWINFN, n3Escape, winEscape} from "../src/utils";


describe('validate bucket/node to be used for naming files', ()=> {
    test('check a string if it contains any symbols or is named using a keyword reserved by Windows for naming files', () => {
        const bucket1 = 'abc123'
        const bucket2 = 'con'
        const bucket3 = '<>:`'
        expect(isInvalidWINFN(bucket1)).toEqual(false)
        expect(isInvalidWINFN(bucket2)).toEqual(true)
        expect(invalidWINRes(bucket3)).toEqual(false)
        expect(invalidWINSYM(bucket3)).toEqual(true)
        expect(winEscape(bucket2)).toEqual("con%")
        expect(winEscape(bucket3)).toEqual("%3C>:`")
        expect(n3Escape(bucket3)).toEqual("<>:'")
    });
})

// describe('escape a symbol with its unicode character when illegal symbols were found', ()=>{
//     test()
// })
