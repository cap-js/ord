/**
 * Test suite for GitHub Copilot integration functionality
 * Verifies that Copilot reviewer automation is properly configured
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('GitHub Copilot Integration', () => {
  const githubDir = path.join(__dirname, '../../.github');
  
  describe('Workflow Configuration', () => {
    it('should have copilot-review.yml workflow file', () => {
      const workflowPath = path.join(githubDir, 'workflows', 'copilot-review.yml');
      expect(fs.existsSync(workflowPath)).toBe(true);
    });

    it('should have valid YAML syntax in copilot-review.yml', () => {
      const workflowPath = path.join(githubDir, 'workflows', 'copilot-review.yml');
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      
      expect(() => {
        yaml.load(workflowContent);
      }).not.toThrow();
    });

    it('should configure correct triggers for copilot-review workflow', () => {
      const workflowPath = path.join(githubDir, 'workflows', 'copilot-review.yml');
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      const workflow = yaml.load(workflowContent);
      
      expect(workflow.on).toBeDefined();
      expect(workflow.on.pull_request).toBeDefined();
      expect(workflow.on.pull_request.types).toContain('opened');
      expect(workflow.on.pull_request.types).toContain('synchronize');
      expect(workflow.on.pull_request.types).toContain('reopened');
    });

    it('should have appropriate permissions in copilot-review workflow', () => {
      const workflowPath = path.join(githubDir, 'workflows', 'copilot-review.yml');
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      const workflow = yaml.load(workflowContent);
      
      expect(workflow.permissions).toBeDefined();
      expect(workflow.permissions.contents).toBe('read');
      expect(workflow.permissions['pull-requests']).toBe('write');
    });
  });

  describe('CODEOWNERS Configuration', () => {
    it('should have CODEOWNERS file', () => {
      const codeownersPath = path.join(githubDir, 'CODEOWNERS');
      expect(fs.existsSync(codeownersPath)).toBe(true);
    });

    it('should include github-copilot[bot] as a code owner', () => {
      const codeownersPath = path.join(githubDir, 'CODEOWNERS');
      const codeownersContent = fs.readFileSync(codeownersPath, 'utf8');
      
      expect(codeownersContent).toContain('@github-copilot[bot]');
    });

    it('should have appropriate file pattern coverage', () => {
      const codeownersPath = path.join(githubDir, 'CODEOWNERS');
      const codeownersContent = fs.readFileSync(codeownersPath, 'utf8');
      
      // Check for common file patterns
      expect(codeownersContent).toContain('*.js');
      expect(codeownersContent).toContain('*.json');
      expect(codeownersContent).toContain('lib/*');
      expect(codeownersContent).toContain('__tests__/*');
    });
  });

  describe('Pull Request Template', () => {
    it('should have pull request template', () => {
      const templatePath = path.join(githubDir, 'pull_request_template.md');
      expect(fs.existsSync(templatePath)).toBe(true);
    });

    it('should include Copilot review section in PR template', () => {
      const templatePath = path.join(githubDir, 'pull_request_template.md');
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      expect(templateContent).toContain('🤖 Automated Review');
      expect(templateContent).toContain('GitHub Copilot');
      expect(templateContent).toContain('For Contributors:');
      expect(templateContent).toContain('For Reviewers:');
    });
  });

  describe('Documentation', () => {
    it('should document Copilot integration in README', () => {
      const readmePath = path.join(__dirname, '../../README.md');
      const readmeContent = fs.readFileSync(readmePath, 'utf8');
      
      expect(readmeContent).toContain('🤖 Automated Code Review');
      expect(readmeContent).toContain('GitHub Copilot');
      expect(readmeContent).toContain('For Contributors');
      expect(readmeContent).toContain('For Reviewers');
    });
  });

  describe('Workflow Integration', () => {
    it('should not conflict with existing workflows', () => {
      const workflowsDir = path.join(githubDir, 'workflows');
      const workflowFiles = fs.readdirSync(workflowsDir);
      
      expect(workflowFiles).toContain('copilot-review.yml');
      expect(workflowFiles).toContain('main.yml');
      expect(workflowFiles).toContain('lint.yml');
      
      // Verify our new workflow doesn't duplicate existing functionality
      const copilotWorkflowPath = path.join(workflowsDir, 'copilot-review.yml');
      const copilotWorkflow = yaml.load(fs.readFileSync(copilotWorkflowPath, 'utf8'));
      
      const mainWorkflowPath = path.join(workflowsDir, 'main.yml');
      const mainWorkflow = yaml.load(fs.readFileSync(mainWorkflowPath, 'utf8'));
      
      // They should have different job names
      expect(Object.keys(copilotWorkflow.jobs)).not.toEqual(Object.keys(mainWorkflow.jobs));
    });
  });
});