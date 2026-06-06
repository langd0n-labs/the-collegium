CONTEXT:

I am building a multi-tenant Event-Driven Multi-Agent system called "The Collegium."

We are intentionally bypassing complex agent DAG frameworks and instead using a standard Event-Driven Architecture (EDA) based on Pub/Sub messaging.

Our frontend UI is Slack. Our message broker is Redis.

We are bootstrapping this platform by heavily modifying the lightweight open-source NanoClaw framework.

CORE CONCEPT:

* Topics/Tenants are mapped to Slack Channels (e.g., #ds100, #ds551, #software-project-a).
* A Collegium is a topic-specific community of expert personas ("Fellows") listening to a channel.
* A Foundry is the execution infrastructure responsible for producing artifacts and fulfilling delegated tasks.

TASK:

Generate a lightweight, containerized Node.js/TypeScript stack based on NanoClaw's design pattern, structured as follows:

1. THE INGRESS ENGINE

* Strip out NanoClaw's sequential request/response logic.

* Retain the Slack Socket Mode client.

* When a message is posted in a channel, extract:

  * channel_id
  * thread_ts
  * user
  * text

* Immediately publish this payload to a Redis Stream named:

  collegium:stream:[channel_id]

* Also subscribe to:

  collegium:outbound

* Any outbound messages should be posted back to the appropriate Slack thread using chat.postMessage.

2. THE FELLOW WORKER

* Create a generic PersonaWorker class/container.

* It subscribes to:

  collegium:stream:[ENV_CHANNEL_ID]

* On every message event, perform a lightweight keyword or semantic activation check using:

  ENV_ACTIVATION_KEYWORDS

* When activated:

  * Retrieve relevant thread history.

  * Call the local Pro Account API Proxy at:

    http://localhost:8001/v1

  * Generate a response.

  * Prefix the response with the Fellow's identity.

  * Publish the result to:

    collegium:outbound

3. THE COMMISSION INTERCEPTOR

- Inside the Fellow output handler, implement a structured commission interceptor.
- If a Fellow response contains:

  COMMISSION: {json_payload}

  then:

  - Extract the JSON payload.
  - Do not post the payload directly to Slack.
  - Push the commission into:

    foundry:commission:[channel_id]

4. THE FOUNDRY WORKER

- Create a stateless background worker.
- Block-pop commissions from:

  foundry:commission:[channel_id]

- Read the commission description.
- Route the commission to the appropriate Forge/capability if needed.
- Execute localized shell commands within a workspace volume.
- Upon completion, publish a success message and generated artifacts to:

  collegium:outbound

DEPLOYMENT ARTIFACTS:

Provide a docker-compose.yaml that launches:

1. Redis

2. One Ingress container

3. Two Fellow containers configured via environment variables:

   * Syllabus Fellow
   * Assessment Fellow

   Both listening to the same DS100 Collegium stream.

4. One Foundry worker container with access to a shared workspace volume.

