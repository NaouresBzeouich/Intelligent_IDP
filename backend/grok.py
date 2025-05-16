from groq import Groq

client = Groq(
    api_key="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"
)

chat_completion = client.chat.completions.create(
    messages=[
        {
            "role": "system",
            "content": "in the context of my internal development platform i want some recommendations to the architectures i should choose between on prem, azure, aws, which tech stack should i choose.. for prem ignore the buying, suppose the servers are already there, ignore the maintenance costs. make one strict final decision for each environment if many are needed"
        },
        #    "content": "in the context of my internal development platform i want some recommendations to the architectures i should choose between on prem, azure, aws, which tech stack should i choose.. for prem ignore the buying, suppose the servers are already there, ignore the maintenance costs. make one strict final decision between them, expected to answer with reasons for each decision. After that suggest starter development template for project (like a boilerplate). concider different infra if many environments are needed"
        # {
        #     "role": "user",
        #     "content": "I have a .NET project with a SQL Server database and I want to deploy it. I am considering on-premises, Azure, and AWS. What should I choose?",
        # },
         {
            "role": "user",
            "content": "I have a project that needs resources it's written in python, ml model, react front end, and it's coomplicated,  and I want to deploy it. I am considering on-premises, Azure, and AWS. I want loadbalancer too and it's microservice What should I choose?want max control over my infra and i don't think i need that much scaling, im gonna have prod, and dev envs",
        },
    ],
    model="llama-3.3-70b-versatile",
    stream=False,
)

print(chat_completion.choices[0].message.content)