FROM library/postgres:9.6

ADD init.sql /docker-entrypoint-initdb.d/
ENV POSTGRES_USER admin
ENV POSTGRES_PASSWORD admin
ENV POSTGRES_DB emojipoetry
