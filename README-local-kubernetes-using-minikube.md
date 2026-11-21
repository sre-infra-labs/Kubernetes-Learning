# Summary - https://youtu.be/rBeyHDKLVqM

This document has instruction to setup kubernetes cluster (using native package management) setup on localhost using minikube.
Current localhost machine is Ubuntu 26.04 (ryzen9)

## Step 1 - Install kubectl
https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/#install-using-native-package-management

## Step 2 - Install minikube
https://minikube.sigs.k8s.io/docs/start/?arch=%2Flinux%2Fx86-64%2Fstable%2Fdebian+package

### Step 2a - Create host folder to mount into minikube (first-time setup)

The host folder `/vm-storage-02/kubernetes-disk` on ryzen9 is mounted into the minikube node as `/hypervisor_disk`. Use it as a hostPath source for persistent volumes.

Create the host folder (only if it doesn't exist yet):

```bash
sudo mkdir -p /vm-storage-02/kubernetes-disk
sudo chown saanvi:saanvi /vm-storage-02/kubernetes-disk
```

The mount is set when the minikube container is **created**, so it must be passed on the first `minikube start`. Use the flags below for a fresh setup:

```bash
minikube delete
minikube start --driver=docker --mount --mount-string="/vm-storage-02/kubernetes-disk:/hypervisor_disk"
```

Verify the mount inside minikube:

```bash
minikube ssh -- ls -la /hypervisor_disk
# Check the bind mount is registered on the minikube container
docker inspect minikube --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' | grep hypervisor_disk
```

Test write-through from host to minikube:

```bash
touch /vm-storage-02/kubernetes-disk/hello-from-host
minikube ssh -- ls /hypervisor_disk
```

> The mount persists across `minikube stop` / `minikube start`, because the minikube container keeps its configuration. If you run `minikube delete`, repeat the `minikube start --mount ...` command above.

### Step 2b - systemd service for minikube & dashboard on port 8001

This runs minikube and the dashboard as **system** services, so they start at boot without anyone logging in. They run as the `saanvi` user, not root: minikube's docker driver refuses to run as root without `--force`, and `saanvi` already has access to Docker through the `docker` group.

The services set `MINIKUBE_HOME` and `KUBECONFIG` to the `saanvi` user's profile and kubeconfig. This keeps the existing cluster and lets `kubectl` work as `saanvi` too.

Complete the first-time `minikube start` with the mount flags from Step 2a before enabling these services, because the services only run `minikube start` for an existing cluster.

`/etc/systemd/system/minikube.service`:

```ini
[Unit]
Description=Minikube Kubernetes cluster
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=saanvi
Environment=HOME=/home/saanvi
Environment=MINIKUBE_HOME=/home/saanvi/.minikube
Environment=KUBECONFIG=/home/saanvi/.kube/config
ExecStart=/usr/bin/minikube start
ExecStop=/usr/bin/minikube stop
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/minikube-dashboard.service`:

```ini
[Unit]
Description=Minikube dashboard on port 8001
After=minikube.service
Requires=minikube.service

[Service]
User=saanvi
Environment=HOME=/home/saanvi
Environment=MINIKUBE_HOME=/home/saanvi/.minikube
Environment=KUBECONFIG=/home/saanvi/.kube/config
# --url prints the URL and does not try to open a browser
ExecStart=/usr/bin/minikube dashboard --port=8001 --url
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Install and start them (create the two files above with `sudo`, then):

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now minikube.service minikube-dashboard.service
sudo systemctl status minikube.service minikube-dashboard.service
```

Open the dashboard at `http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/http:kubernetes-dashboard:/proxy/`.

If you created the earlier user-level units, remove them so they don't conflict:

```bash
systemctl --user disable --now minikube.service minikube-dashboard.service
rm -f ~/.config/systemd/user/minikube.service ~/.config/systemd/user/minikube-dashboard.service
```

Useful commands:

```bash
sudo journalctl -u minikube-dashboard -f            # dashboard logs
sudo systemctl restart minikube-dashboard           # restart only the dashboard
sudo systemctl stop minikube-dashboard minikube     # stop everything (stops the cluster)
```

Stopping `minikube.service` runs `minikube stop`. The cluster and the host mount are kept, as described in Step 2a.

### Step 2c - Start minikube

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
cd /stale-storage/GitHub/Kubernetes-Learning/projects/M.Prashant/nodejs/testapp
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
|---------- $ kubectl apply -f Kubernetes-Learning/projects/M.Prashant/nodejs/testapp-deployment.yml
  deployment.apps/my-web-app created
```

# YAML based service - https://kubernetes.io/docs/concepts/services-networking/service/#defining-a-service

```bash
|---------- $ kubectl apply -f projects/M.Prashant/nodejs/testapp-service.yml
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
  - This can lead to multiple db containers running and accepting db requests (split brain)
- Run each container in separate pod

```bash
# same-pod-deployment
kubectl apply -f projects/M.Prashant/multi-container-app/db-demo-app---same-pod-deployment.yml
minikube service my-nodedb-app

# multi-pod-deployment
cd /stale-storage/GitHub/Kubernetes-Learning/projects/M.Prashant/multi-container-app/db-demo-app---multi-pod-deployment

grep -n "mongoose.connect" index.js    # should show a backtick URL using MONGO_HOST
docker build -t imajaydwivedi/node-mongo-db:05 .
docker push imajaydwivedi/node-mongo-db:05


cd /stale-storage/GitHub/Kubernetes-Learning/

kubectl apply -f projects/M.Prashant/multi-container-app/db-demo-app---host-pv---multi-pod-deployment.yml
kubectl apply -f projects/M.Prashant/multi-container-app/db-demo-app---mongodb---multi-pod-deployment.yml
kubectl apply -f projects/M.Prashant/multi-container-app/db-demo-app---config-map---multi-pod-deployment.yml
kubectl apply -f projects/M.Prashant/multi-container-app/db-demo-app---node-app---multi-pod-deployment.yml

kubectl logs -l app=node-app -f
kubectl get all
kubectl get persistentvolume
kubectl get persistentvolumeclaims
minikube service service-node-app
```

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

# Simulate kill/crash of containers

```bash
#Delete the pod (Deployment recreates it):
kubectl get pods -l app=mongo-app
kubectl delete pod -l app=mongo-app
kubectl get pods -l app=mongo-app -w

#Kill the mongod process inside the running container (kubelet restarts it in the same pod, RESTARTS goes up):
POD=$(kubectl get pod -l app=mongo-app -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $POD -c mongo-app -- bash -c 'kill -9 $(pgrep mongod)'
kubectl get pods -l app=mongo-app -w

#If pgrep isn't in the image, use kubectl exec -it $POD -c mongo-app -- bash -c 'kill -9 $(ps -eo pid,comm | awk "/mongod/{print \$1}")', or check the process with kubectl exec -it $POD -c mongo-app -- ps aux.
```


