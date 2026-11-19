# Summary - https://youtu.be/rBeyHDKLVqM

This document has instruction to setup kubernetes cluster (using native package management) setup on localhost using minikube.
Current localhost machine is Ubuntu 26.04 (ryzen9)

## Step 1 - Install kubectl
https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/#install-using-native-package-management

## Step 2 - Install minikube
https://minikube.sigs.k8s.io/docs/start/?arch=%2Flinux%2Fx86-64%2Fstable%2Fdebian+package

```
|---------- $ minikube start
  😄  minikube v1.39.0 on Ubuntu 26.04
  ✨  Automatically selected the docker driver. Other choices: kvm2, none, ssh
  📌  Using Docker driver with root privileges
  👍  Starting "minikube" primary control-plane node in "minikube" cluster
  🚜  Pulling base image v0.0.51 ...
  💾  Downloading Kubernetes v1.37.0 preload ...
      > preloaded-images-k8s-v18-v1...:  347.58 MiB / 347.58 MiB  100.00% 3.05 Mi
      > gcr.io/k8s-minikube/kicbase:  507.60 MiB / 507.61 MiB  100.00% 2.10 MiB p
  🔥  Creating docker container (CPUs=2, Memory=32100MB) ...
  📦  Preparing Kubernetes v1.37.0 on containerd 2.3.4 ...
  🔗  Configuring CNI (Container Networking Interface) ...
  🔎  Verifying Kubernetes components...
      ▪ Using image gcr.io/k8s-minikube/storage-provisioner:v5
  🌟  Enabled addons: storage-provisioner, default-storageclass
  🏄  Done! kubectl is now configured to use "minikube" cluster and "default" namespace by default


|---------- $ minikube status
  minikube
  type: Control Plane
  host: Running
  kubelet: Running
  apiserver: Running
  kubeconfig: Configured


|---------- $ kubectl cluster-info 
  Kubernetes control plane is running at https://192.168.49.2:8443
  CoreDNS is running at https://192.168.49.2:8443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy

  To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.
```

## Step 3 - Create deployment

```bash
kubectl create deployment my-nginx --image=nginx:latest
kubectl create deployment my-web-app --image=imajaydwivedi/webapp-demo:v2.0

|---------- $ kubectl get deployments
  NAME       READY   UP-TO-DATE   AVAILABLE   AGE
  my-nginx   1/1     1            1           29s


|---------- $ kubectl get pods
  NAME                        READY   STATUS    RESTARTS   AGE
  my-nginx-5d6bbc895b-2x79r   1/1     Running   0          47s


|---------- $ minikube dashboard
  🔌  Enabling dashboard ...
      ▪ Using image docker.io/kubernetesui/dashboard:v2.7.0
      ▪ Using image docker.io/kubernetesui/metrics-scraper:v1.0.8
  💡  Some dashboard features require the metrics-server addon. To enable all features please run:

          minikube addons enable metrics-server

  🤔  Verifying dashboard health ...
  🚀  Launching proxy ...
  🤔  Verifying proxy health ...


  🎉  Opening http://127.0.0.1:34187/api/v1/namespaces/kubernetes-dashboard/services/http:kubernetes-dashboard:/proxy/ in your default browser...
  Opening in existing browser session.
  [168921:168921:0100/000000.251743:ERROR:content/zygote/zygote_linux.cc:662] write: Broken pipe (32)
  [1:1:0100/000000.252950:ERROR:content/zygote/zygote_main_linux.cc:197] Failed sending zygote boot message: Broken pipe (32)


|---------- $ kubectl expose deployment my-nginx --port=80 --type=LoadBalancer
  service/my-nginx exposed
|---------- $ kubectl expose deployment my-web-app --port=3000 --type=LoadBalancer
service/my-web-app exposed

|---------- $ kubectl get service
  NAME         TYPE           CLUSTER-IP       EXTERNAL-IP      PORT(S)          AGE
  kubernetes   ClusterIP      10.96.0.1        <none>           443/TCP          29h
  my-nginx     LoadBalancer   10.110.147.219   10.110.147.219   80:30421/TCP     29h
  my-web-app   LoadBalancer   10.109.58.49     <pending>        3000:32106/TCP   45s

  |---------- $ minikube service my-nginx
  ┌───────────┬──────────┬─────────────┬───────────────────────────┐
  │ NAMESPACE │   NAME   │ TARGET PORT │            URL            │
  ├───────────┼──────────┼─────────────┼───────────────────────────┤
  │ default   │ my-nginx │ 80          │ http://192.168.49.2:30421 │
  └───────────┴──────────┴─────────────┴───────────────────────────┘
  🎉  Opening service default/my-nginx in default browser...

  Opening in existing browser session.
  [1:1:0100/000000.926480:ERROR:content/zygote/zygote_main_linux.cc:197] Failed sending zygote boot message: Broken pipe (32)
  [178169:178169:0100/000000.926541:ERROR:content/zygote/zygote_linux.cc:662] write: Broken pipe (32)


|---------- $ minikube service my-web-app
  ┌───────────┬────────────┬─────────────┬───────────────────────────┐
  │ NAMESPACE │    NAME    │ TARGET PORT │            URL            │
  ├───────────┼────────────┼─────────────┼───────────────────────────┤
  │ default   │ my-web-app │ 3000        │ http://192.168.49.2:32106 │
  └───────────┴────────────┴─────────────┴───────────────────────────┘
  🎉  Opening service default/my-web-app in default browser...
  Opening in existing browser session.
  [1:1:0100/000000.159579:ERROR:content/zygote/zygote_main_linux.cc:197] Failed sending zygote boot message: Broken pipe (32)
  [460989:460989:0100/000000.159645:ERROR:content/zygote/zygote_linux.cc:662] write: Broken pipe (32)
```

# Debugging

```bash
# 
kubectl get deployments
kubectl get pods
kubectl describe pod -l app=my-web-app
kubectl logs -l app=my-web-app

```

# Update image

```bash
# build & push image
cd /stale-storage/GitHub/Kubernetes-Learning/projects/nodejs/testapp
docker build -t imajaydwivedi/webapp-demo:v3.0 .
docker push imajaydwivedi/webapp-demo:v3.0

# update image for a pod container
kubectl get deployments
kubectl set image deployment <deployment_name> <container_name> image=<image:version_tag>
kubectl set image deployment my-web-app webapp-demo=imajaydwivedi/webapp-demo:v4.0

# create a buggy rollout & roll it back afterwards
kubectl set image deployment my-web-app webapp-demo=imajaydwivedi/webapp-demo:v10.0
kubectl rollout status deployment my-web-app
kubectl rollout undo deployment my-web-app
```

# Scaling of App

```bash
# create 4 instances
kubectl scale deployment my-web-app --replicas=4

# crash app
http://192.168.49.2:32106/exit

# get pods
|---------- $ kubectl get pods
  NAME                          READY   STATUS    RESTARTS      AGE
  my-web-app-6d4b9466f7-qjl8f   1/1     Running   3 (31s ago)   38m
  my-web-app-6d4b9466f7-ql8qg   1/1     Running   0             93s
  my-web-app-6d4b9466f7-s9gn8   1/1     Running   2 (26s ago)   93s
  my-web-app-6d4b9466f7-xl9wj   1/1     Running   1 (50s ago)   93s

```

# YAML based deployment - https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#creating-a-deployment

```bash
# run deployment from a file
|---------- $ kubectl apply -f Kubernetes-Learning/projects/nodejs/testapp-deployment.yml
  deployment.apps/my-web-app created
```

# YAML based service - https://kubernetes.io/docs/concepts/services-networking/service/#defining-a-service

```bash
|---------- $ kubectl apply -f projects/nodejs/testapp-service.yml
  service/my-web-app created

|---------- $ kubectl get service
  NAME         TYPE           CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
  kubernetes   ClusterIP      10.96.0.1       <none>        443/TCP        2d9h
  my-web-app   LoadBalancer   10.98.251.122   <pending>     80:30277/TCP   105s

|---------- $ minikube service my-web-app
  ┌───────────┬────────────┬─────────────┬───────────────────────────┐
  │ NAMESPACE │    NAME    │ TARGET PORT │            URL            │
  ├───────────┼────────────┼─────────────┼───────────────────────────┤
  │ default   │ my-web-app │ 80          │ http://192.168.49.2:30277 │
  └───────────┴────────────┴─────────────┴───────────────────────────┘
  🎉  Opening service default/my-web-app in default browser...
  Opening in existing browser session.

```

# To run application with multiple containers

- Run multiple containers in same pod
- Run each container in separate pod

# Cleanup

```bash
|---------- $ kubectl get deployments
  NAME         READY   UP-TO-DATE   AVAILABLE   AGE
  my-nginx     1/1     1            1           29h
  my-web-app   1/1     1            1           11m

# remove deployment
|---------- $ kubectl delete deployment my-nginx
  deployment.apps "my-nginx" deleted from default namespace

# remove service
|---------- $ kubectl delete service my-nginx
  service "my-nginx" deleted from default namespace

|---------- $ kubectl get pods
  NAME                          READY   STATUS             RESTARTS       AGE
  my-web-app-775c77c4f4-292cr   0/1     Error              5 (2m1s ago)   87m
  my-web-app-775c77c4f4-96rbh   1/1     Running            0              61s
  my-web-app-775c77c4f4-dbgpm   0/1     CrashLoopBackOff   5 (2m2s ago)   87m
  my-web-app-775c77c4f4-wbkjj   1/1     Running            2 (14s ago)    61s

kubectl describe pod -l app=my-web-app
kubectl logs -l app=my-web-app

#Find the not-ready pods:
kubectl get pods -l app=web-app

#See why the pod is not ready. Check the State, Last State, Reason, and Exit Code fields, plus the Events section at the bottom.
kubectl describe pod <pod>

#Logs from the crashed run (the one that matters for CrashLoopBackOff):
kubectl logs <pod> --previous

#Logs from the current run (if it's still starting):
kubectl logs <pod>

#Limit the output to recent lines:
kubectl logs <pod> --previous --tail=50

#Stream logs live while the pod restarts:
kubectl logs <pod> -f

#Exit code and reason of the last crash:
kubectl get pod <pod> -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'

#Logs from every web-app pod at once:
kubectl logs -l app=web-app --all-containers --prefix --tail=20
```

