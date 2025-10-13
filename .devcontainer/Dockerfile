FROM node:20-bookworm

WORKDIR /workspace

# give node user permission to install global packages
RUN chown -R node:node /usr/local/lib/node_modules && \
    chown -R node:node /usr/local/bin

# run as non-root user for safety
USER node