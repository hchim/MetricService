##Middleware

Middlewares are defined in the middleware directory. For example the error handler middleware
is defined in the error_handler.js file. These middlewares should be reusable in other projects. 

##Route

Routes are defined in the routes directory.

##Start Service

### Production mode

>NODE_ENV=production npm start

### Test mode

>NODE_ENV=test npm start

### Debug mode

>DEBUG=*:* npm start

###Specify env

The following command will start the server on port 9000.

```
$PORT=9000 npm start
```

##Test

- start the service in test mode.
- run `npm test`.

##About timezone

1. Mongodb uses UTC time by default. Date range query will be converted to UTC time.


