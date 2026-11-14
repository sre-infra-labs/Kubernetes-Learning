# Kubernetes-Learning
I share my Kubernetes related learnings

# Install Kubernetes Cluster

This file contains instructions to setup a 3-node kubernetes cluster using below KVM vms.
Master has its own kvm vm.

## Machines
- KubeMaster (192.168.100.60)
  - Cluster master
- KubeNode1 (192.168.100.57)
  - Kubernetes node 1
- KubeNode2 (192.168.100.58)
  - Kubernetes node 2
- KubeNode3 (192.168.100.59)
  - Kubernetes node 3

## Prerequisites
- 4 KVM virtual machines running Red Hat Enterprise Linux 10.3 (one master, three nodes)
- At least 2 vCPUs and 5 GB RAM per VM (the master needs 2 vCPUs for `kubeadm`)
- Static IPs as listed above, and all VMs can reach each other and the internet
- Each VM registered to a Red Hat subscription (or a local repo mirror) so `dnf` can install packages
- Unique hostname and MAC address / `product_uuid` on every VM
- A sudo-capable user on each VM
- `/etc/hosts` on every VM contains the entries for all four machines (see below)

The examples below use Kubernetes `v1.34` and `containerd` as the container runtime, with Flannel as the pod network. Replace the version in the repository URL if you want a different minor release.

Hostnames on the VMs are lowercase (`kubemaster`, `kubenode1`, ...). Commands below use the same names.

## Step 1: Verify hostnames and /etc/hosts (all VMs)

Each VM should already have its own static hostname. Confirm it with:

```bash
hostnamectl
```

If it needs changing, set it to the matching name from the Machines list:

```bash
sudo hostnamectl set-hostname kubemaster   # on the master
sudo hostnamectl set-hostname kubenode1    # on node 1
sudo hostnamectl set-hostname kubenode2    # on node 2
sudo hostnamectl set-hostname kubenode3    # on node 3
```

`/etc/hosts` on **every** VM contains:

```text
192.168.100.60 kubemaster
192.168.100.57 kubenode1
192.168.100.58 kubenode2
192.168.100.59 kubenode3
```

## Step 2: Prepare the OS (all VMs)

Kubernetes requires swap to be disabled and some kernel modules and sysctl settings to be enabled.

```bash
# Disable swap now and across reboots
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab

# Load required kernel modules now and at boot
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay
sudo modprobe br_netfilter

# Networking settings required for bridged traffic and IP forwarding
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system
```

### SELinux

The kubeadm and kubelet packages expect SELinux to be permissive (or configured for containers). This guide sets it to permissive:

```bash
sudo setenforce 0
sudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config
```

### Firewall

RHEL enables `firewalld` by default. For a lab you can disable it on every VM:

```bash
sudo systemctl disable --now firewalld
```

To keep it running, open the required ports instead.

On **KubeMaster**:

```bash
sudo firewall-cmd --permanent --add-port=6443/tcp        # Kubernetes API server
sudo firewall-cmd --permanent --add-port=2379-2380/tcp   # etcd
sudo firewall-cmd --permanent --add-port=10250/tcp       # kubelet API
sudo firewall-cmd --permanent --add-port=10259/tcp       # kube-scheduler
sudo firewall-cmd --permanent --add-port=10257/tcp       # kube-controller-manager
sudo firewall-cmd --permanent --add-port=8472/udp        # Flannel VXLAN
sudo firewall-cmd --reload
```

On **each worker node**:

```bash
sudo firewall-cmd --permanent --add-port=10250/tcp       # kubelet API
sudo firewall-cmd --permanent --add-port=30000-32767/tcp # NodePort services
sudo firewall-cmd --permanent --add-port=8472/udp        # Flannel VXLAN
sudo firewall-cmd --reload
```

## Step 3: Install containerd (all VMs)

```bash
sudo dnf install -y containerd
```

If `containerd` is not available in your enabled repositories, install `containerd.io` from Docker's CentOS/RHEL repository instead.

```bash
# Generate the default config and switch to the systemd cgroup driver
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml >/dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

sudo systemctl enable --now containerd
```

## Step 4: Install kubeadm, kubelet and kubectl (all VMs)

Add the Kubernetes yum repository:

```bash
cat <<EOF | sudo tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://pkgs.k8s.io/core:/stable:/v1.34/rpm/
enabled=1
gpgcheck=1
gpgkey=https://pkgs.k8s.io/core:/stable:/v1.34/rpm/repodata/repomd.xml.key
exclude=kubelet kubeadm kubectl cri-tools kubernetes-cni
EOF

sudo dnf install -y kubelet kubeadm kubectl --disableexcludes=kubernetes
sudo systemctl enable --now kubelet
```

The `exclude=` line keeps `dnf upgrade` from upgrading these packages by accident. It is the RPM equivalent of `apt-mark hold`.

## Step 5: Initialize the master (KubeMaster only)

```bash
sudo kubeadm init \
  --apiserver-advertise-address=192.168.100.60 \
  --pod-network-cidr=10.244.0.0/16
```

When it finishes, configure `kubectl` for your regular user:

```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

Save the `kubeadm join ...` command printed at the end of the output. You will need it for the nodes. If you lose it, generate a new one on the master:

```bash
kubeadm token create --print-join-command
```

## Step 6: Install the pod network (KubeMaster only)

The nodes stay `NotReady` until a pod network add-on is installed. This guide uses Flannel, which matches the `10.244.0.0/16` CIDR used above:

```bash
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
```

## Step 7: Join the worker nodes (KubeNode1, KubeNode2, KubeNode3)

Run the `kubeadm join` command you saved from Step 5 on each node, with `sudo`:

```bash
sudo kubeadm join 192.168.100.60:6443 --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash>
```

## Step 8: Verify the cluster (KubeMaster)

Wait a minute or two for the pods to start, then check:

```bash
kubectl get nodes -o wide
kubectl get pods -A
```

Expected result: all four nodes show `Ready`, and the `kube-system` pods (including `kube-flannel-ds` on each node) are `Running`.

Optional quick test:

```bash
kubectl create deployment nginx --image=nginx --replicas=3
kubectl get pods -o wide
```

## Troubleshooting

- **Node stays `NotReady`:** check `kubectl get pods -A` for Flannel pods, and run `sudo journalctl -u kubelet -f` on the node.
- **`kubeadm init` fails on preflight checks:** confirm swap is off (`free -h`), the `br_netfilter` module is loaded (`lsmod | grep br_netfilter`), and `containerd` is running (`systemctl status containerd`).
- **Join token expired (after 24 hours):** run `kubeadm token create --print-join-command` on the master.
- **Pods cannot reach each other across nodes:** make sure `firewalld` allows the ports listed above (or is disabled), and that the Flannel pods are running on every node.
- **Access denied on the containers socket or SELinux errors in logs:** confirm `getenforce` reports `Permissive`.
- **Reset a node and try again:** `sudo kubeadm reset -f`, then remove `$HOME/.kube` on the master if you are starting over.
