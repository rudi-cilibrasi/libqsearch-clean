FROM node:19.5.0-alpine

ARG WORKDIR_PATH=/complearn
ARG USER_NAME=node

RUN mkdir -p ${WORKDIR_PATH}/node_modules && chown -R ${USER_NAME}:${USER_NAME} ${WORKDIR_PATH}
WORKDIR ${WORKDIR_PATH}
USER ${USER_NAME}
COPY --chown=${USER_NAME}:${USER_NAME} . .
RUN npm install

EXPOSE 3000
CMD ["node", "./bin/www"]