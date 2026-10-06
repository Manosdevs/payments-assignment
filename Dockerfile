# Single stage with all dependencies (Jest included), so the same image can
# serve the API and run `docker compose run --rm app npm test`.
# See design.md › Local setup. A slim multi-stage production image is listed
# under "Before production".
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/index.js"]
