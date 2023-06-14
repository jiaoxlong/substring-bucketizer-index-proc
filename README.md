# Substring bucketization pipeline

Use Case: creating linked data fragments from literals follow specified triple pattern(s) in a graph for substring autocompletion [1].

[1]: Dedecker, R., Delva, H., Colpaert, P., Verborgh, R. (2021). A File-Based Linked Data Fragments Approach to Prefix Search. In: Brambilla, M., Chbeir, R., Frasincar, F., Manolescu, I. (eds) Web Engineering. ICWE 2021. Lecture Notes in Computer Science(), vol 12706. Springer, Cham. https://doi.org/10.1007/978-3-030-74296-6_5

The substring autocompletion pipeline has been implemented based on the [connector architecture](https://github.com/TREEcg/connector-architecture/wiki) and consists of the processors listed below. 
The processors marked with `*` were newly introduced, whereas the rest were invoked from [sds-processors](https://github.com/ajuvercr/sds-processors/tree/master).
Note that data pushed to the ones from sds-processors 

- SPARQL query processor*
  - fetch SPARQL query result using Comunica queryEngine
- Sdsity processor
  - serialize quads with SDS vocabularies
- Bucketization processor
  - bucketize quads based on the value of propertyPath defined in `./config/config.json` for substring search
- SDS to TREE processor*
  - remodel the quads according to the TREE specification
- Ingestion processor*
  - per chunk of quads from stream
    - asynchronously allocate to its corresponding bucket (fragment)
    - add quads of tree:remainingItems count 
    - write/append to file, defaults to turtle format.
    
## Usage

### Prerequisite

- Prepare a configuration file. An example can be found at `./config/config.json`

- Before executing the pipeline, one may need to sync your CA local repo, update submodules and recompile the codebase, if the repository was previously cached locally.

```shell
git clone https://github.com/TREEcg/connector-architecture.git
cd processor/substring-bucketizer-index-proc
node  ../../runner/js-runner/bin/js-runner.js ./sparql-sdsify-bucketizer-tree-file-pipeline.ttl
```


