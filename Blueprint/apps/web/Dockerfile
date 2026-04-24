# Build + run Next.js in one container for simplicity.
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Used by next.config.js rewrite to reach the backend container
ARG BACKEND_URL=http://127.0.0.1:8081
ENV BACKEND_URL=$BACKEND_URL

ARG NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

ARG NEXT_PUBLIC_SAARTHIX_URL
ENV NEXT_PUBLIC_SAARTHIX_URL=$NEXT_PUBLIC_SAARTHIX_URL

RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start"]

