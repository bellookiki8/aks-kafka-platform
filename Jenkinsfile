pipeline {
  agent {
    kubernetes {
      yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: kaniko
      image: gcr.io/kaniko-project/executor:v1.23.2-debug
      command: ["/busybox/cat"]
      tty: true
    - name: kubectl
      image: bitnamilegacy/kubectl:latest
      command: ["/bin/cat"]
      tty: true
'''
    }
  }

  environment {
    ACR = 'acrkafkaplatformdev.azurecr.io'
    NAMESPACE = 'orders'
    TAG = "${BUILD_NUMBER}"
  }

  stages {
    stage('Build and push images') {
      steps {
        container('kaniko') {
          withCredentials([usernamePassword(credentialsId: 'acr-credentials', usernameVariable: 'ACR_USER', passwordVariable: 'ACR_PASS')]) {
            sh '''
              AUTH=$(printf "%s:%s" "$ACR_USER" "$ACR_PASS" | base64 | tr -d '\\n')
              mkdir -p /kaniko/.docker
              cat > /kaniko/.docker/config.json <<EOF
{ "auths": { "acrkafkaplatformdev.azurecr.io": { "auth": "${AUTH}" } } }
EOF
              for svc in producer consumer frontend; do
                echo "Building $svc"
                /kaniko/executor --context ./app/$svc --dockerfile ./app/$svc/Dockerfile --destination acrkafkaplatformdev.azurecr.io/order-$svc:${TAG}
              done
            '''
          }
        }
      }
    }

    stage('Deploy to AKS') {
      steps {
        container('kubectl') {
          withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {
            sh '''
              echo "Ensuring the orders topic exists"
              kubectl exec kafka-broker-0 -n kafka -- kafka-topics.sh --create --if-not-exists --topic orders --bootstrap-server localhost:9092 --partitions 3 --replication-factor 2
              echo "Updating images"
              kubectl set image deployment/producer producer=acrkafkaplatformdev.azurecr.io/order-producer:${TAG} -n ${NAMESPACE}
              kubectl set image deployment/consumer consumer=acrkafkaplatformdev.azurecr.io/order-consumer:${TAG} -n ${NAMESPACE}
              kubectl set image deployment/frontend frontend=acrkafkaplatformdev.azurecr.io/order-frontend:${TAG} -n ${NAMESPACE}
              echo "Waiting for rollouts"
              kubectl rollout status deployment/producer -n ${NAMESPACE} --timeout=120s
              kubectl rollout status deployment/consumer -n ${NAMESPACE} --timeout=120s
              kubectl rollout status deployment/frontend -n ${NAMESPACE} --timeout=120s
            '''
          }
        }
      }
    }
  }
}
