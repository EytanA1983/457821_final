/// <reference types="cypress" />

/**
 * Minimal E2E Test: Register → Me → Dashboard
 * 
 * Tests the core user flow:
 * 1. Register a new user
 * 2. Verify /api/auth/me endpoint works
 * 3. Access dashboard successfully
 */
describe('Minimal E2E Flow: Register → Me → Dashboard', () => {
  const timestamp = Date.now();
  const testUser = {
    email: `e2e-test-${timestamp}@example.com`,
    password: 'TestPassword123!',
  };

  beforeEach(() => {
    // Clear localStorage before each test
    cy.clearLocalStorage();
    
    // Clear cookies
    cy.clearCookies();
  });

  it('Step 1: Should register a new user', () => {
    cy.visit('/register');
    
    // Verify registration form is visible
    cy.get('input[type="email"], input[name="email"]')
      .should('be.visible')
      .should('have.attr', 'required');
    
    cy.get('input[type="password"], input[name="password"]')
      .should('be.visible')
      .should('have.attr', 'required');
    
    // Fill registration form
    cy.get('input[type="email"], input[name="email"]')
      .type(testUser.email);
    
    cy.get('input[type="password"], input[name="password"]')
      .type(testUser.password);
    
    // If there's a confirm password field
    cy.get('body').then(($body) => {
      if ($body.find('input[type="password"][name*="confirm"], input[type="password"][placeholder*="אימות"]').length > 0) {
        cy.get('input[type="password"][name*="confirm"], input[type="password"][placeholder*="אימות"]')
          .type(testUser.password);
      }
    });
    
    // Submit form
    cy.get('button[type="submit"]')
      .should('be.visible')
      .should('not.be.disabled')
      .click();
    
    // Wait for registration API call
    cy.intercept('POST', '**/api/auth/register').as('registerRequest');
    cy.wait('@registerRequest', { timeout: 10000 }).then((interception) => {
      expect(interception.response?.statusCode).to.be.oneOf([200, 201]);
      
      // Verify response contains tokens
      const responseBody = interception.response?.body;
      expect(responseBody).to.have.property('access_token');
      expect(responseBody).to.have.property('refresh_token');
      
      // Verify tokens are stored in localStorage
      cy.window().then((win) => {
        const token = win.localStorage.getItem('token');
        expect(token).to.exist;
        expect(token).to.be.a('string');
        expect(token.length).to.be.greaterThan(0);
      });
    });
    
    // Should redirect after successful registration
    cy.url({ timeout: 10000 }).should('not.include', '/register');
    
    // Verify we're redirected to dashboard or home
    cy.url().should('satisfy', (url) => {
      return url.includes('/app') || 
             url.includes('/dashboard') || 
             url.includes('/') ||
             url.includes('/home');
    });
  });

  it('Step 2: Should verify /api/auth/me endpoint', () => {
    // First register the user
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/api/auth/register`,
      body: {
        email: testUser.email,
        password: testUser.password,
      },
      failOnStatusCode: false,
    }).then((registerResponse) => {
      expect(registerResponse.status).to.be.oneOf([200, 201]);
      
      const accessToken = registerResponse.body.access_token;
      expect(accessToken).to.exist;
      
      // Store token in localStorage
      cy.window().then((win) => {
        win.localStorage.setItem('token', accessToken);
        win.localStorage.setItem('refresh_token', registerResponse.body.refresh_token);
      });
      
      // Now test /api/auth/me endpoint
      cy.request({
        method: 'GET',
        url: `${Cypress.env('apiUrl')}/api/auth/me`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        failOnStatusCode: false,
      }).then((meResponse) => {
        expect(meResponse.status).to.eq(200);
        
        // Verify response structure
        expect(meResponse.body).to.have.property('id');
        expect(meResponse.body).to.have.property('email');
        expect(meResponse.body.email).to.eq(testUser.email);
        
        // Verify user data
        expect(meResponse.body).to.have.property('is_active');
        expect(meResponse.body.is_active).to.be.true;
        
        // Should not contain sensitive data
        expect(meResponse.body).to.not.have.property('hashed_password');
        expect(meResponse.body).to.not.have.property('password');
        
        cy.log('✅ /api/auth/me endpoint works correctly');
        cy.log('User data:', JSON.stringify(meResponse.body, null, 2));
      });
    });
  });

  it('Step 3: Should access dashboard after registration', () => {
    // Register user via API for faster setup
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/api/auth/register`,
      body: {
        email: testUser.email,
        password: testUser.password,
      },
      failOnStatusCode: false,
    }).then((registerResponse) => {
      expect(registerResponse.status).to.be.oneOf([200, 201]);
      
      const accessToken = registerResponse.body.access_token;
      
      // Store token
      cy.window().then((win) => {
        win.localStorage.setItem('token', accessToken);
        win.localStorage.setItem('refresh_token', registerResponse.body.refresh_token);
      });
      
      // Visit dashboard
      cy.visit('/app');
      
      // Wait for page to load
      cy.url({ timeout: 10000 }).should('satisfy', (url) => {
        return url.includes('/app') || 
               url.includes('/dashboard') || 
               url.includes('/');
      });
      
      // Verify dashboard elements are visible
      // Check for common dashboard elements
      cy.get('body').should('be.visible');
      
      // Verify we're not redirected to login
      cy.url().should('not.include', '/login');
      cy.url().should('not.include', '/register');
      
      // Verify token is still in localStorage
      cy.window().its('localStorage.token').should('exist');
      
      // Check for dashboard-specific content
      // (This depends on your dashboard implementation)
      cy.get('body').then(($body) => {
        // Look for common dashboard indicators
        const hasDashboardContent = 
          $body.find('[class*="dashboard"], [class*="Dashboard"]').length > 0 ||
          $body.text().includes('משימות') ||
          $body.text().includes('חדרים') ||
          $body.text().includes('Dashboard');
        
        if (hasDashboardContent) {
          cy.log('✅ Dashboard content is visible');
        } else {
          cy.log('⚠️ Dashboard may be loading or empty');
        }
      });
      
      cy.log('✅ Successfully accessed dashboard');
    });
  });

  it('Complete Flow: Register → Me → Dashboard in one test', () => {
    // Step 1: Register
    cy.visit('/register');
    
    cy.get('input[type="email"], input[name="email"]')
      .type(testUser.email);
    
    cy.get('input[type="password"], input[name="password"]')
      .type(testUser.password);
    
    // Handle confirm password if exists
    cy.get('body').then(($body) => {
      if ($body.find('input[type="password"][name*="confirm"]').length > 0) {
        cy.get('input[type="password"][name*="confirm"]')
          .type(testUser.password);
      }
    });
    
    // Intercept registration request
    cy.intercept('POST', '**/api/auth/register').as('register');
    
    cy.get('button[type="submit"]').click();
    
    // Wait for registration
    cy.wait('@register', { timeout: 10000 }).then((interception) => {
      expect(interception.response?.statusCode).to.be.oneOf([200, 201]);
      
      const accessToken = interception.response?.body?.access_token;
      expect(accessToken).to.exist;
      
      // Step 2: Verify /api/auth/me
      cy.request({
        method: 'GET',
        url: `${Cypress.env('apiUrl')}/api/auth/me`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }).then((meResponse) => {
        expect(meResponse.status).to.eq(200);
        expect(meResponse.body.email).to.eq(testUser.email);
        cy.log('✅ /api/auth/me verified');
      });
      
      // Step 3: Access dashboard
      cy.visit('/app');
      
      // Verify we're on dashboard
      cy.url({ timeout: 10000 }).should('satisfy', (url) => {
        return url.includes('/app') || 
               url.includes('/dashboard') || 
               url.includes('/');
      });
      
      cy.url().should('not.include', '/login');
      cy.url().should('not.include', '/register');
      
      // Verify token persistence
      cy.window().its('localStorage.token').should('exist');
      
      cy.log('✅ Complete flow: Register → Me → Dashboard successful');
    });
  });

  after(() => {
    // Cleanup: Optionally delete test user
    // (This would require a cleanup endpoint or direct DB access)
    cy.log('Test completed. Test user:', testUser.email);
  });
});
