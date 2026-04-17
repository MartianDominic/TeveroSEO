FROM nginx:1.27-alpine

# curl needed for compose healthcheck (nginx:alpine doesn't ship it)
RUN apk add --no-cache curl

# Replace default config with our unified multi-domain config
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
