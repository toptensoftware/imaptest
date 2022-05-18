@echo off
SETLOCAL
IF "%1" == "stop" set XSTOP=1
IF "%1" == "restart" set XSTOP=1
IF "%1" == "start" set XSTART=1
IF "%1" == "restart" set XSTART=1

if "%XSTOP%" == "1" (
    docker stop test_dovecot test_mongo
)

if "%XSTART%" == "1" (
    docker run --detach --rm --name test_dovecot -p 44143:143 --mount type=bind,source=c:\users\brad\projects\imaptest\dovecot\etc\dovecot,target=/etc/dovecot dovecot/dovecot
    docker run --detach --rm --name test_mongo -p 44017:27017 mongo --replSet rs0
    docker exec test_mongo mongosh --eval "rs.initiate()"
)
