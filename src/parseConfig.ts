import {IConfig, N3FormatTypes} from './types';
import {exists, isSPARQLEndpoint, isValidURL, sparql_ask_query} from "./utils";
import * as path from "path";
import * as fs from "fs";
import { readFileSync } from 'graceful-fs';

//const config = require('../config/config.json')

export class Config implements IConfig{
    _config!: { [p: string]: any }
    _configPath!: string
    _bucketizerOptions!: { [p: string]: any }
    _namespace_iri!: string
    _path?:string
    _namespace_prefix?:string
    _prefixes?: { [p: string]: string }|undefined
    _sparqlEndpoint?: string|undefined
    _sparqlQuery?: string|undefined
    _propertyPath!: string[]|string
    _format?:typeof N3FormatTypes[number]


    constructor(config_path:string) {
        if (exists(config_path)) {
            this._config = JSON.parse(readFileSync(config_path).toString());
            this._configPath = config_path
            //this._config = require(path.join(__dirname,config_ins))
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
            if(this.config.bucketizerOptions.propertyPath!==undefined)
                this._propertyPath = this.config.bucketizerOptions.propertyPath
            else
                throw new Error('propertyPath must be assigned!'  )

            if(this.config.format !== undefined)
                this._format = this.config.format
            else
                this._format = 'Turtle'
            if(this.config.path !== undefined)
                this._path = path.resolve(this.config.path)
            else
                this._path = path.resolve()
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

    get configPath(){
        return this._configPath
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
    get path():string{
        return <string>this._path
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
    get propertyPath():string[]|string{
        return this._propertyPath
    }
    get format():string|undefined{
        return this._format
    }
}

let _config: Config | undefined;
export function getConfig(configPath: string): Config {
    if (_config) return _config;
    _config = new Config(configPath);
    return _config;
}
