# 신규 클러스터 부트스트랩 (dev / stg / prd 공통)

`lgair-datahub-{dev,stg,prd}` GKE 클러스터에 DataHub 애플리케이션을 배포하기 전에 **모든 환경이 동일하게 갖춰야 하는 클러스터 레벨 리소스**를 한 곳에 기록한다.

## 설치 대상

| 리소스 | 버전 | 용도 |
|---|---|---|
| `ingress-nginx` | `4.15.1` | 단일 LoadBalancer 진입점. `loadBalancerSourceRanges` 로 사내 CIDR 만 허용. `externalTrafficPolicy: Local` 필수 (client IP 보존) |
| `cert-manager` | `v1.20.1` | TLS 인증서 자동 발급/갱신 |
| Cloud DNS SA Secret | — | cert-manager 가 Cloud DNS 로 DNS-01 challenge 를 쓰기 위한 자격증명 |
| `ClusterIssuer letsencrypt-prod` | — | Let's Encrypt DNS-01 발급자 |
| Namespace `lgair-datahub` | — | 애플리케이션 리소스 네임스페이스 |

## 사전 준비 (1회, 프로젝트 단위)

다음은 **첫 클러스터 부트스트랩 전에 한 번만** 수행한다. 이후 신규 클러스터 추가 시 재생성 불필요.

```bash
# 1) Cloud DNS zone (lgair-data.com 전용)
gcloud dns managed-zones create lgair-data-com \
  --project lgair-dg-data-hub \
  --dns-name="lgair-data.com." \
  --description="DataHub 전용 도메인. prd/dev/stg + cert-manager DNS-01 solver." \
  --visibility=public \
  --dnssec-state=off

# 2) 가비아에서 lgair-data.com 의 네임서버를 Cloud DNS 네임서버 4개로 교체
#    (gcloud dns managed-zones describe lgair-data-com --format='value(nameServers)')

# 3) cert-manager 용 서비스 계정 + dns.admin 권한
gcloud iam service-accounts create cert-manager-dns01 \
  --project lgair-dg-data-hub \
  --display-name="cert-manager DNS-01 solver"

gcloud projects add-iam-policy-binding lgair-dg-data-hub \
  --member="serviceAccount:cert-manager-dns01@lgair-dg-data-hub.iam.gserviceaccount.com" \
  --role="roles/dns.admin" --condition=None

# 4) SA key 발급 (이 파일을 각 클러스터의 cert-manager ns Secret 으로 주입)
gcloud iam service-accounts keys create /tmp/cert-manager-dns01.json \
  --iam-account=cert-manager-dns01@lgair-dg-data-hub.iam.gserviceaccount.com \
  --project lgair-dg-data-hub

# 5) 환경별 도메인 A 레코드 (Cloud DNS)
#    api.datahub.lgair-data.com      → prd LB IP
#    datahub.lgair-data.com          → prd LB IP (web)
#    api-dev.datahub.lgair-data.com  → dev LB IP
#    dev.datahub.lgair-data.com      → dev LB IP (web)
#    api-stg.datahub.lgair-data.com  → stg LB IP
#    stg.datahub.lgair-data.com      → stg LB IP (web)
```

## 클러스터별 부트스트랩 순서

```bash
# 0) 대상 클러스터 자격 증명
STAGE=dev   # or stg / prd
gcloud container clusters get-credentials lgair-datahub-${STAGE} \
  --region us-central1 --project lgair-dg-data-hub
CTX="gke_lgair-dg-data-hub_us-central1_lgair-datahub-${STAGE}"

# 1) ingress-nginx — 반드시 이 디렉토리의 values 파일 사용 (CIDR 화이트리스트 포함)
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm --kube-context $CTX install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --version 4.15.1 \
  -f deploy/cluster-bootstrap/ingress-nginx-values.yaml \
  --wait --timeout 5m

# 2) cert-manager
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm --kube-context $CTX install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --version v1.20.1 \
  --set crds.enabled=true \
  --wait --timeout 5m

# 3) DNS-01 solver 용 SA key Secret 주입
#
# 3-A) 최초(1회): 위 "사전 준비 4)" 에서 발급한 /tmp/cert-manager-dns01.json 으로 생성
kubectl --context $CTX -n cert-manager create secret generic cert-manager-dns01-key \
  --from-file=key.json=/tmp/cert-manager-dns01.json
#
# 3-B) 2번째 이후 클러스터: 이미 다른 클러스터에 주입된 같은 SA 키를 그대로 이식
#      (SA 당 키 개수 제한이 있어 불필요한 신규 키 발급을 피한다)
# SRC_CTX=gke_lgair-dg-data-hub_us-central1_lgair-datahub-dev   # 또는 -stg
# kubectl --context $SRC_CTX -n cert-manager get secret cert-manager-dns01-key -o yaml \
#   | grep -v -E "^\s+(resourceVersion|uid|creationTimestamp):" \
#   | kubectl --context $CTX apply -f -

# 4) ClusterIssuer (DNS-01 solver)
kubectl --context $CTX apply -f deploy/cluster-bootstrap/cluster-issuer.yaml

# 5) 애플리케이션 네임스페이스
kubectl --context $CTX create namespace lgair-datahub --dry-run=client -o yaml \
  | kubectl --context $CTX apply -f -

# 6) Ingress LB 외부 IP 확인 (Cloud DNS A 레코드에 등록된 값과 일치해야 함)
kubectl --context $CTX -n ingress-nginx get svc ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
echo
```

## 현재 할당된 LB IP (참고)

| 클러스터 | Ingress LB IP |
|---|---|
| `lgair-datahub-dev` | `34.70.114.15` |
| `lgair-datahub-stg` | `136.114.158.232` |
| `lgair-datahub-prd` | `34.9.114.129` |

## TLS 발급 동작

cert-manager 가 Ingress 의 `cert-manager.io/cluster-issuer: letsencrypt-prod` annotation 을 감지하면:

1. 임시 `Order` 리소스 생성
2. Let's Encrypt 에 인증서 발급 요청
3. Cloud DNS 에 `_acme-challenge.<domain>` TXT 레코드 **자동 쓰기** (우리 SA 로)
4. Let's Encrypt 가 DNS 서버를 조회하여 소유권 검증
5. 인증서 발급 → K8s Secret 으로 저장 (`spec.tls.secretName`)
6. TTL 만료 전 자동 갱신 (cert-manager 내부 주기)

**외부에서 LB:80 에 접근할 필요 없음** → `loadBalancerSourceRanges` 를 사내 CIDR 만 유지해도 정상 동작한다.

## GCS Service Account key

애플리케이션 배포 전에 `gcs-service-account-key` Secret 을 `lgair-datahub` 네임스페이스에 생성해야 한다. prd SA 재활용 여부는 운영 결정 항목.

```bash
kubectl --context $CTX -n lgair-datahub create secret generic gcs-service-account-key \
  --from-file=key.json=<path-to-gcs-sa-key.json>
```

## 애플리케이션 배포

부트스트랩 완료 후는 `deploy/README.md` 의 Helm 배포 절차를 따른다. CI/CD 로 자동 배포하려면 해당 브랜치(`develop` / `staging` / `main`)에 push 한다.
