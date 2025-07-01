# GuideCO

# 💡 Code Guide – AI Programming Assistant

Code Guide is a lightweight, responsive, and interactive web-based AI assistant designed specifically to help programmers. Built with HTML, TailwindCSS, and JavaScript, it leverages the **Gemini API** to provide real-time code assistance with varying levels of detail.

## 🚀 Features

* ✨ **Chat-like Interface** — Smooth messaging UI for developer conversations.
* 🔐 **Local API Key Management** — Securely store Gemini API key in your browser.
* 🧠 **Gemini AI Integration** — Interact with the Gemini 1.5 model to solve coding queries.
* 🎛️ **Adjustable Response Detail** — Choose from "Concise", "Balanced", or "Detailed" guidance.
* 🎨 **Minimal & Responsive Design** — Built using Tailwind CSS with a clean and accessible layout.
* 📝 **Markdown & Code Formatting** — Supports markdown rendering in assistant replies.

## 📸 Preview

> *“Hi! I'm Code Guide, your AI programming assistant. How can I help you with your code today?”*

![screenshot](https://via.placeholder.com/600x400?text=Code+Guide+AI+Assistant+UI)

## 🔧 Setup Instructions

1. **Clone this repository**

   ```bash
   git clone https://github.com/your-username/code-guide.git
   cd code-guide
   ```

2. **Open `index.html` in your browser**
   You can simply double-click the `index.html` file, or serve it using a local server:

   ```bash
   npx serve .
   ```

3. **Set your Gemini API Key**

   * Click the ⚙️ Settings icon.
   * Enter your Gemini API Key.
   * Choose your preferred response style.
   * Click **Save Settings**.

> ✅ The API key is stored locally in your browser and never sent anywhere else.

## 🧠 How It Works

* When you enter a message, it sends a request to Gemini’s content generation endpoint:

  ```
  POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent
  ```

* The system dynamically adapts its tone and verbosity based on the **Response Style** setting.

## 📁 Project Structure

```
📦 code-guide/
├── index.html          # Main frontend UI and logic
├── README.md           # You're reading this!
```

## 🛠️ Technologies Used

* **TailwindCSS** – For rapid UI styling
* **Vanilla JS** – For all interactivity and API integration
* **Gemini API** – Google's Generative Language Model
* **HTML/CSS** – Base markup and styling

## ⚠️ Limitations

* No backend or authentication layer; all settings are stored in `localStorage`.
* Requires a valid Gemini API Key from [Google AI Studio](https://makersuite.google.com/app).
* Designed for desktop — UI is not fully optimized for mobile yet.

## 📌 Future Improvements

* [ ] Add persistent chat history
* [ ] Enhance mobile responsiveness
* [ ] Support for voice input/output
* [ ] Auto language detection and syntax highlighting

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

