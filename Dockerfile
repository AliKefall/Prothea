FROM golang:1.26-alpine AS build

WORKDIR /src
RUN apk add --no-cache ca-certificates git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/prothea ./cmd/server

FROM alpine:3.22
RUN apk add --no-cache ca-certificates && addgroup -S app && adduser -S -G app app
COPY --from=build /out/prothea /usr/local/bin/prothea
USER app
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/prothea"]
