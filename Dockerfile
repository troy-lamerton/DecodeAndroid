FROM node:lts AS node_ndk_base

## set env variables

ENV ANDROID_NDK_HOME=/opt/android-ndk \
    NDK_VERSION=r16b

ENV NDK_NAME=android-ndk-${NDK_VERSION} \
    NDK_ZIP_NAME=android-ndk-${NDK_VERSION}-linux-x86_64.zip

ENV PATH ${PATH}:${ANDROID_NDK_HOME}

## download android ndk

ADD http://dl.google.com/android/repository/$NDK_ZIP_NAME /tmp/android-ndk/$NDK_ZIP_NAME
RUN cd /tmp/android-ndk \
    && unzip -q ${NDK_ZIP_NAME} \
    && mv ./${NDK_NAME} $ANDROID_NDK_HOME \
    && rm -rf /tmp/android-ndk
# remove bloat
RUN rm -rf ${ANDROID_NDK_HOME}/sources \
    && rm -rf ${ANDROID_NDK_HOME}/platforms


## run server
FROM node_ndk_base AS decoder_prod

## add the server code

COPY . /server
WORKDIR /server
RUN yarn install --frozen-lockfile --non-interactive --production=false
RUN yarn dist

ENV NODE_ENV production
CMD yarn production-docker
