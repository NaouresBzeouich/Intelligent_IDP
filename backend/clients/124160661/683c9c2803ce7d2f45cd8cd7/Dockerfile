FROM mcr.microsoft.com/dotnet/sdk:7.0 AS build
ENV DB_URL="123.45.67.89"
ENV DB_PORT="2739"
WORKDIR /src
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:7.0
ENV DB_URL="123.45.67.89"
ENV DB_PORT="2739"

WORKDIR /app
COPY --from=build /app .

ENTRYPOINT ["dotnet", "MyApi.dll"]