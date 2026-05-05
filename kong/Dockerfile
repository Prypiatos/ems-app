FROM kong:3.4-alpine

# Copy declarative config into the image
WORKDIR /usr/local/kong/declarative
COPY kong.yml /usr/local/kong/declarative/kong.yml

# Run Kong in DB-less (declarative) mode using the included config
ENV KONG_DATABASE=off
ENV KONG_DECLARATIVE_CONFIG=/usr/local/kong/declarative/kong.yml

# Expose proxy and admin ports
EXPOSE 8000 8443 8001 8444

CMD ["kong", "docker-start"]
