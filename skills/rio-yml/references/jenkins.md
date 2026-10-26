# Jenkins (declarative `Jenkinsfile`)

```groovy
@Library('ci-lib@v1.4.0') _          // shared library: reuse steps across repos

pipeline {
  agent none
  options {
    timeout(time: 45, unit: 'MINUTES')
    disableConcurrentBuilds(abortPrevious: false)   // queue new builds of this branch, never abort the running one
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
  }
  parameters {
    choice(name: 'DEPLOY_ENV', choices: ['staging', 'production'], description: 'Target environment')
    choice(name: 'PLAY_TRACK', choices: ['internal', 'alpha', 'beta', 'production'], description: 'Play track')
    booleanParam(name: 'DRY_RUN', defaultValue: true)
  }
  triggers {
    cron(env.BRANCH_NAME == 'main' ? '''TZ=Asia/Jakarta
H 2 * * *''' : '')
  }
  stages {
    stage('Unit') {
      agent { label 'linux-build' }
      steps {
        sh './gradlew testDebugUnitTest'
      }
      post { always { junit 'app/build/test-results/**/*.xml' } }
    }
    stage('Build') {
      parallel {                                     // parallel branches, joined before the next stage
        stage('Android') {
          agent { label 'linux-build' }
          steps {
            sh './gradlew bundleRelease'
            stash name: 'aab', includes: 'app/build/outputs/bundle/release/*.aab'   // hand-off to another agent
          }
        }
        stage('iOS') {
          agent { label 'macos-xcode-16' }
          steps {
            sh 'bundle exec fastlane ios build'
            stash name: 'ipa', includes: 'build/*.ipa'
          }
        }
      }
    }
    stage('E2E Android') {
      matrix {
        axes { axis { name 'API_LEVEL'; values '30', '34' } }
        agent { label 'android-emulator' }
        stages {
          stage('Run') {
            steps {
              unstash 'aab'
              sh "./ci/run-e2e.sh ${API_LEVEL}"
            }
            post { always { junit 'e2e-results/*.xml' } }
          }
        }
      }
    }
    stage('Deploy') {
      when { buildingTag() }
      agent { label 'deploy-prod' }
      input { message 'Release to Play?'; submitter 'release-managers' }
      steps {
        lock(resource: 'play-release') {             // Lockable Resources: serialise across jobs
          unstash 'aab'
          archiveArtifacts artifacts: 'app/build/outputs/bundle/release/*.aab', fingerprint: true
          sh 'bundle exec fastlane android internal'
        }
      }
    }
  }
}
```

- `stash`/`unstash` move files between agents within one build; `archiveArtifacts` keeps files on the controller after the build (results, releases). Large binaries → artifact repository (Nexus, Artifactory, S3) instead.
- `parameters` render as a form on "Build with Parameters"; the first `choice` is the default. Parameters take effect after the first run registers them.
- `disableConcurrentBuilds()` without `abortPrevious: true` queues builds; the running build is not touched.
- `input` inside a stage with `agent` holds an executor while waiting — put `input` in the stage-level `input {}` directive (evaluated before the agent is allocated), as above.
