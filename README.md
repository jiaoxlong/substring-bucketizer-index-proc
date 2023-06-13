# Substring autocompletion pipeline

Use Case: creating linked data fragments from literals follow specified triple pattern(s) in a graph for substring autocompletion [1].

[1]: Dedecker, R., Delva, H., Colpaert, P., Verborgh, R. (2021). A File-Based Linked Data Fragments Approach to Prefix Search. In: Brambilla, M., Chbeir, R., Frasincar, F., Manolescu, I. (eds) Web Engineering. ICWE 2021. Lecture Notes in Computer Science(), vol 12706. Springer, Cham. https://doi.org/10.1007/978-3-030-74296-6_5

The substring autocompletion pipeline has been implemented based on the [connector architecture](https://github.com/TREEcg/connector-architecture/wiki) and consists of the processors listed below. The processors marked with `*` were newly introduced in this pipeline, whereas the rest were invoked from [sds-processors](https://github.com/ajuvercr/sds-processors/tree/master).

- SPARQL query processor*
- Sdsity processor
- Bucketization processor
- SDS to TREE processor*
- Ingestion processor*

## Usage

### Prerequisite
Before executing the pipeline, one may need to update [sds-processors repository](https://github.com/ajuvercr/sds-processors/tree/master) and recompile the codebase, if the repository was previously cached locally.

```shell
git clone https://github.com/TREEcg/connector-architecture.git
cd processor/substring-bucketizer-index-proc
node  ../../runner/js-runner/bin/js-runner.js ./sparql-sdsify-bucketizer-tree-file-pipeline.ttl
```


