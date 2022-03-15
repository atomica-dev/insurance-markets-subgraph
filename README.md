# Deployment

1.
```
npm run update-subgraph-yaml <environment-id>
```

2.
```
npm run codegen && npm run build
```

3.
```
GRAPH_LOCATION='<graph-slug>' GRAPH_AUTH_TOKEN=<deploy-key> npm run deploy
```
