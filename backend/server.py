from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
import os


app = Flask(__name__)
CORS(app)

client = Groq(api_key=("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"))

@app.route('/chat', methods=['GET'])
def chat():
    user_message = request.args["message"]
    # user_message = data.get("message", "")

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "in the context of my internal development platform i want some recommendations "
                        "to the architectures i should choose between on prem, azure, aws, which tech stack should i choose.. kubernetes is no option "
                        "for prem ignore the buying, suppose the servers are already there, ignore the maintenance costs. "
                        "the expected response should be a strict final decision at the begginging of the answer, followed by explainations, "
                    )
                },
                {
                    "role": "user",
                    "content": user_message
                }
            ],
            model="llama-3.3-70b-versatile",
            stream=False,
        )
        reply = chat_completion.choices[0].message.content
        return jsonify({"response": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
