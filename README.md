# Intro to Step Functions Workshop

## Building the workshop static site with Hugo

#### 1. Install Hugo:
On a mac:

`brew install hugo`

On Linux:
  - Download from the releases page: https://github.com/gohugoio/hugo/releases/tag/v0.37
  - Extract and save the executable to `/usr/local/bin`

#### 2. Clone this repo:

`git clone` this repo onto your workstation

#### 3. Install node packages:

`cd website`
`npm install`

#### 4. Run Hugo locally:

`cd website && npm run server`

#### 5. View Hugo locally:
Visit http://localhost:1313/ to see the site.

#### 6. Making Edits:
In order to create the nice copy-to-clipboard and 'click to view diff' features, we're using a strategy of pre-processing markdown files to generate source content that is then read by Hugo.

0. Start the hugo server using the step above
1. Edit files in `website/source_content`
2. `cd website/scripts`
3. `npm run build`
4. Check for updated content in the browser. 
5. Repeat steps 1-4 until you're happy with the content.

note: shift-reload may be necessary in your browser to reflect the latest changes.