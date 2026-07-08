# Contributing to ALwrity

Thank you for your interest in contributing to ALwrity! 🚀 We welcome contributions from the community and appreciate your help in making this AI-powered digital marketing platform even better.

## 🤝 How to Contribute

### 1. **Report Issues**
- Use our [GitHub Issues](https://github.com/AJaySi/ALwrity/issues) to report bugs or request features
- Check existing issues before creating new ones
- Provide clear descriptions and steps to reproduce bugs

### 2. **Submit Pull Requests**
- Fork the repository
- Create a feature branch: `git checkout -b feature/amazing-feature`
- Make your changes and test thoroughly
- Submit a pull request with a clear description

### 3. **Code Contributions**
- Follow our coding standards (see below)
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass before submitting

## 🛠️ Development Setup

### Prerequisites
- **Python 3.10+** (Backend: FastAPI, SQLAlchemy, AI integrations)
- **Node.js 18+** (Frontend: React, TypeScript, Material-UI)
- **Git** (Version control)
- **API Keys** (Gemini, OpenAI, Anthropic, etc.)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/AJaySi/ALwrity.git
cd ALwrity

# Backend setup
cd backend
python -m venv venv
# Activate on Windows: venv\Scripts\activate
# Activate on Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
cp env_template.txt .env  # Configure your API keys
python migrate_schema.py  # Run database migrations
python start_alwrity_backend.py

# Frontend setup (in a new terminal)
cd frontend
npm install
cp env_template.txt .env  # Configure your API keys and environment
npm start
```

## 📝 Coding Standards

### Python (Backend)
- **Style**: Follow PEP 8 guidelines, use Black formatter
- **Type Hints**: Use type hints for all function parameters and return values
- **Documentation**: Add comprehensive docstrings using Google style
- **Error Handling**: Use proper exception handling with meaningful error messages
- **Logging**: Use structured logging with appropriate levels
- **API Design**: Follow RESTful principles, use FastAPI best practices
- **Database**: Use SQLAlchemy ORM, implement proper migrations

### TypeScript/React (Frontend)
- **TypeScript**: Strict mode enabled, no `any` types
- **Components**: Functional components with hooks, proper prop typing
- **State Management**: Use React hooks, consider context for global state
- **Styling**: Material-UI components, consistent theming
- **Error Boundaries**: Implement error boundaries for better UX
- **Performance**: Use React.memo, useMemo, useCallback where appropriate
- **Testing**: Jest + React Testing Library for unit tests

### ALwrity-Specific Guidelines
- **AI Integration**: Always handle API rate limits and errors gracefully
- **Content Generation**: Implement proper validation and sanitization
- **SEO Features**: Follow SEO best practices in generated content
- **User Experience**: Maintain consistent UI/UX across all features
- **Security**: Validate all inputs, implement proper authentication

## 🧪 Testing

### Backend Testing
```bash
cd backend
python -m pytest tests/
```

### Frontend Testing
```bash
cd frontend
npm test
```

## 📋 Pull Request Guidelines

### Before Submitting
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] No merge conflicts

### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Backend tests pass
- [ ] Frontend tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots to help explain your changes
```

## 🏷️ Issue Labels

We use the following labels to categorize issues:
- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements or additions to documentation
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed
- `priority: high`: High priority issues
- `priority: low`: Low priority issues

## 💬 Community Guidelines

- Be respectful and inclusive
- Help others learn and grow
- Provide constructive feedback
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md)

## 🎯 Areas for Contribution

### High Priority
- **Bug Fixes**: Critical issues affecting core functionality
- **Performance**: API response times, database optimization
- **Documentation**: API docs, user guides, setup instructions
- **Test Coverage**: Unit tests, integration tests, E2E tests
- **Security**: Vulnerability fixes, security improvements

### Feature Areas
- **AI Content Generation**: Blog posts, social media content, SEO optimization
- **SEO Dashboard**: Google Search Console integration, analytics
- **Social Media**: LinkedIn, Facebook, Instagram content creation
- **Content Planning**: Calendar management, content strategy
- **User Experience**: Onboarding flow, dashboard improvements
- **Analytics**: Usage tracking, performance metrics
- **Integrations**: Third-party API integrations, webhooks

### Good First Issues
Look for issues labeled with `good first issue` - these are perfect for newcomers:
- Documentation improvements
- UI/UX enhancements
- Test additions
- Bug fixes with clear reproduction steps
- Feature requests with detailed specifications

## 📞 Getting Help

- Join our [Discussions](https://github.com/AJaySi/ALwrity/discussions)
- Check existing [Issues](https://github.com/AJaySi/ALwrity/issues)
- Review [Documentation](https://github.com/AJaySi/ALwrity/wiki)

## 🙏 Recognition

Contributors will be recognized in our README and release notes. Thank you for helping make ALwrity better for everyone!

---

**Happy Contributing!** 🎉
