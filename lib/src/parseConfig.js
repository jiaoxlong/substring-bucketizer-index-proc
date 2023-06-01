"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = exports.Config = void 0;
const utils_1 = require("./utils");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const graceful_fs_1 = require("graceful-fs");
const n3_1 = require("n3");
var namedNode = n3_1.DataFactory.namedNode;
const types_1 = require("@treecg/types");
//const config = require('../config/config.json')
class Config {
    constructor(config_path) {
        if ((0, utils_1.exists)(config_path)) {
            this._config = JSON.parse((0, graceful_fs_1.readFileSync)(config_path).toString());
            this._configPath = config_path;
            //this._config = require(path.join(__dirname,config_ins))
        }
        else
            throw Error(config_path + " can not be found.");
    }
    setup() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this._config.sparql.sparqlEndpoint && this._config.sparql.sparqlQuery) {
                if (yield (0, utils_1.isSPARQLEndpoint)(this.config.sparql.sparqlEndpoint, utils_1.sparql_ask_query)) {
                    this._sparqlEndpoint = this.config.sparql.sparqlEndpoint;
                }
                else
                    throw new Error(`SPARQL endpoint: ${this.config.sparql.sparqlEndpoint} can not be reached!`);
                const sparqlPath = path.join(path.dirname(this._configPath), this.config.sparql.sparqlQuery);
                if ((0, utils_1.exists)(sparqlPath)) {
                    console.log();
                    this._sparqlQuery = fs.readFileSync(sparqlPath, 'utf8');
                }
                else
                    throw new Error('The SPARQL query returns no result!');
                if ((0, utils_1.isValidURL)(this.config.namespace.namespace_iri))
                    this._namespace_iri = this.config.namespace.namespace_iri;
                else
                    throw new Error(`Invalid namespace IRI: ${this._config.namespace.namespace_iri}`);
                this._namespace_prefix = (_a = this.config.namespace.prefix) !== null && _a !== void 0 ? _a : 'ex';
                if (this.config.bucketizer.propertyPath === '' || this.config.bucketizer.propertyPath === undefined)
                    throw new Error('propertyPath is not defined!');
                else
                    this._bucketizerOptions = this.config.bucketizer;
                if (this.config.relationType !== undefined && Object.keys(types_1.RelationType).includes(this.config.relationType))
                    this._relationType = this.config.relationType;
                else
                    this._relationType = "Substring";
                if ((0, utils_1.exists)(this.config.prefixes)) {
                    this._prefixes = JSON.parse((0, graceful_fs_1.readFileSync)(this.config.prefixes).toString());
                }
                if (this.config.bucketizer.propertyPath !== undefined)
                    this._propertyPath = this.config.bucketizer.propertyPath;
                else
                    throw new Error('propertyPath must be assigned!');
                if (this.config.format !== undefined)
                    this._format = this.config.format;
                else
                    this._format = 'Turtle';
                if (this.config.path !== undefined)
                    this._path = path.resolve(this.config.path);
                else
                    this._path = path.resolve();
            }
            /**
             * reserved for other processors
             */
            else {
            }
            return this;
        });
    }
    get config() {
        return this._config;
    }
    get configPath() {
        return this._configPath;
    }
    get sparqlEndpoint() {
        return this._sparqlEndpoint;
    }
    get relationType() {
        return this._relationType;
    }
    get sparqlQuery() {
        return this._sparqlQuery;
    }
    get namespaceIRI() {
        return this._namespace_iri;
    }
    get path() {
        return this._path;
    }
    get namespacePrefix() {
        return this._namespace_prefix;
    }
    get bucketizerOptions() {
        return this._bucketizerOptions;
    }
    get root() {
        return namedNode(this.bucketizerOptions.bucketBase + this.bucketizerOptions.root);
    }
    get prefixes() {
        return this._prefixes;
    }
    get propertyPath() {
        return this._propertyPath;
    }
    get format() {
        return this._format;
    }
}
exports.Config = Config;
let _config;
function getConfig(configPath) {
    if (_config)
        return _config;
    _config = new Config(configPath);
    return _config;
}
exports.getConfig = getConfig;
