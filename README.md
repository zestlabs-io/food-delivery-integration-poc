# ZEST Functions to integrate with ODOO Food delivery

## AWS Installation

Se the following parameters in [AWS Lambda](./lambda/serverless.yml)

```yaml
  environment:
    LOCATIONIQ_KEY: <LOCATIONIQ_KEY>
    ODO_USERNAME: <ODO_USERNAME>
    ODO_PASSWORD: <ODO_PASSWORD>
    ZEST_KEY: <ZEST_KEY>
    ZEST_SECRET: <ZEST_SECRET>
```

Adjust the resouce section with your account id `XXXXXXXXXXXX`:

```yaml
      Resource:
        - "arn:aws:lambda:eu-west-3:XXXXXXXXXXXX:function:food-delivery-service-fetch-deliveries"
```

Install [serverless cli](https://www.serverless.com/framework/docs/getting-started/)

### Deploying

Make sure the AWS Account params are set.

```sh
cd lambda
sls package
sls deploy
```

### Allow ZEST Cloud to run the functions

```
cd labda
./add-permission.sh
```