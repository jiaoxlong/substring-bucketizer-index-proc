import {IConfig, N3FormatTypes} from './types';
import {exists, isSPARQLEndpoint, isValidURL, sparql_ask_query} from "./utils";
import * as path from "path";
import * as fs from "fs";
import {QueryEngine} from "@comunica/query-sparql";
import { readFileSync } from 'graceful-fs';

//const config = require('../config/config.json')

export class Config implements IConfig{
    _config!: { [p: string]: any };
    _bucketizerOptions!: { [p: string]: any };
    _namespace_iri!: string;
    _namespace_prefix?:string;
    _prefixes?: { [p: string]: string }|undefined;
    _sparqlEndpoint?: string|undefined;
    _sparqlQuery?: string|undefined;
    _format?:typeof N3FormatTypes[number];

    constructor(config_ins:string) {
        if (exists(config_ins)) {
        JSON.parse(readFileSync(config_ins).toString());
            this._config = require(path.join(__dirname,config_ins))
        }
    }
    async setup():Promise<Config> {
        if (this._config.sparql.sparqlEndpoint && this._config.sparql.sparqlQuery) {
            if (await isSPARQLEndpoint(this.config.sparql.sparqlEndpoint, sparql_ask_query)) {
                this._sparqlEndpoint = this.config.sparql.sparqlEndpoint
            } else
                throw new Error(`SPARQL endpoint: ${this.config.sparql.sparqlEndpoint} can not be reached!`)

            if (exists(this.config.sparql.sparqlQuery)) {
                this._sparqlQuery = fs.readFileSync(path.join(__dirname, this.config.sparql.sparqlQuery), 'utf8')
            } else
                throw new Error('The SPARQL query returns no result!')
            if (isValidURL(this.config.namespace.namespace_iri))
                this._namespace_iri = this.config.namespace.namespace_iri
            else
                throw new Error(`Invalid namespace IRI: ${this._config.namespace.namespace_iri}`)
            this._namespace_prefix = this.config.namespace.prefix ?? 'ex'
            if (this.config.bucketizer.propertyPath === '' || this.config.bucketizer.propertyPath === undefined)
                throw new Error('propertyPath is not defined!')
            else
                this._bucketizerOptions = this.config.bucketizer
            if (exists(this.config.prefixes)) {
                this._prefixes = this.config.prefixes
            }
        }
        /**
         * reserved for other processors
         */

        else {

        }
        return this
    }

    get config(){
        return this._config
    }

    get sparqlEndpoint():string{
        return <string>this._sparqlEndpoint
    }
    get sparqlQuery():string{
        return <string>this._sparqlQuery
    }

    get namespaceIRI():string{
        return this._namespace_iri
    }

    get namespacePrefix():string{
        return <string>this._namespace_prefix
    }

    get bucketizerOptions(): {[p:string]: any} {
        return this._bucketizerOptions
    }
    get prefixes():{[p:string]:string} | undefined{
        return this._prefixes
    }
    get format():string|undefined{
        if (this.config.format){
            return this.config.format
        }
        else{
            return 'Turtle'
        }
    }


}
