# Multi Container App

```bash
cd "/stale-storage/GitHub/Kubernetes-Learning/projects/db-demo-app"

docker build -t imajaydwivedi/node-mongo-db:01 .
docker push imajaydwivedi/node-mongo-db:01

# Create docker network
docker network create kube-learning-network
docker network ls

# To run mongodb container
docker run -d -p 27017:27017 --network kube-learning-network --name mongo mongo

# To run Node app
docker run -d --network kube-learning-network -p 3001:3000 --name myapp imajaydwivedi/node-mongo-db:01

# crash app
curl http://localhost:3001/exit
docker start myapp
docker ps
docker logs myapp -f
```


